import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AdminLogin } from './components/AdminLogin';
import { AdminPanel } from './components/AdminPanel';
import { BookingWizard } from './components/BookingWizard';
import { CafeHome } from './components/CafeHome';
import { INITIAL_BOOKINGS, INITIAL_TABLES } from './data/cafeData';
import type { Booking, CafeTable } from './types';
import './App.css';

type AdminSession = { id?: string; name?: string; email: string; role?: 'owner' | 'staff'; preview: boolean };

const PREVIEW_SESSION_KEY = 'corner-cafe-admin-preview';

function readStoredValue<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    return saved ? (JSON.parse(saved) as T) : fallback;
  } catch {
    return fallback;
  }
}

function readStoredTables(): CafeTable[] {
  const storedTables = readStoredValue<CafeTable[]>('corner-cafe.tables', INITIAL_TABLES);
  const storedById = new Map(storedTables.map((table) => [table.id, table]));
  return INITIAL_TABLES.map((table) => ({
    ...table,
    ...(storedById.get(table.id) ?? {}),
    floor: table.floor,
    zone: table.zone,
  }));
}

function MainApp() {
  const [tables, setTables] = useState<CafeTable[]>(readStoredTables);
  const [bookings, setBookings] = useState<Booking[]>(() => readStoredValue('corner-cafe.bookings', INITIAL_BOOKINGS));
  const [adminSession, setAdminSession] = useState<AdminSession | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const reservationParams = new URLSearchParams(location.search);
  const initialPartySize = Number(reservationParams.get('partySize'));

  useEffect(() => {
    localStorage.setItem('corner-cafe.tables', JSON.stringify(tables));
  }, [tables]);

  useEffect(() => {
    localStorage.setItem('corner-cafe.bookings', JSON.stringify(bookings));
  }, [bookings]);

  useEffect(() => {
    let active = true;

    const restoreSession = async () => {
      const previewEmail = sessionStorage.getItem(PREVIEW_SESSION_KEY);
      if (previewEmail) {
        if (active) setAdminSession({ email: previewEmail, preview: true });
        if (active) setAuthLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/admin/auth?action=session', { credentials: 'include' });
        if (!response.ok) return;
        const result = await response.json().catch(() => ({}));
        const admin = result?.admin;
        if (active && typeof admin?.email === 'string') setAdminSession({ ...admin, preview: false });
      } catch {
        // The frontend can still be explored when the identity service is not connected.
      } finally {
        if (active) setAuthLoading(false);
      }
    };

    void restoreSession();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!adminSession || adminSession.preview) return;
    let active = true;
    setBookings([]);
    const loadDashboard = async () => {
      try {
        const [reservationResponse, tableResponse] = await Promise.all([
          fetch('/api/admin/reservations', { credentials: 'include' }),
          fetch('/api/admin/tables', { credentials: 'include' }),
        ]);
        if (!reservationResponse.ok || !tableResponse.ok) throw new Error('Could not load the shared cafe dashboard. Please refresh.');
        const reservationData = await reservationResponse.json();
        const tableData = await tableResponse.json();
        if (active) {
          setBookings(reservationData.bookings ?? []);
          setTables(tableData.tables ?? []);
          setDashboardError(null);
        }
      } catch (error) {
        if (active) setDashboardError(error instanceof Error ? error.message : 'Could not load cafe data.');
      }
    };
    void loadDashboard();
    const refreshTimer = window.setInterval(() => { void loadDashboard(); }, 30_000);
    return () => { active = false; window.clearInterval(refreshTimer); };
  }, [adminSession?.email, adminSession?.preview]);

  const handleBookingComplete = async (booking: Booking): Promise<Booking> => {
    let response: Response;
    try {
      response = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(booking),
      });
    } catch {
      throw new Error('The reservation service could not be reached. Please try again.');
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result?.error?.message ?? 'We could not save this reservation. Please try another table or time.');
    return result.booking as Booking;
  };

  const handleUpdateBookingStatus = async (
    bookingId: string,
    newStatus: 'confirmed' | 'pending' | 'cancelled'
  ): Promise<void> => {
    if (adminSession && !adminSession.preview) {
      const response = await fetch(`/api/admin/reservation?id=${encodeURIComponent(bookingId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setDashboardError(result?.error?.message ?? 'Could not update this reservation.');
        return;
      }
      setBookings((previous) => previous.map((booking) => booking.id === bookingId ? result.booking : booking));
      setDashboardError(null);
      return;
    }
    const target = bookings.find((booking) => booking.id === bookingId);
    setBookings((previous) => previous.map((booking) =>
      booking.id === bookingId ? { ...booking, status: newStatus } : booking
    ));

    if (newStatus === 'cancelled' && target) {
      setTables((previous) => previous.map((table) =>
        table.id === target.table.id ? { ...table, isAvailable: true } : table
      ));
    }
  };

  const handleAdminLogin = async (email: string, password: string) => {
    let response: Response;
    try {
      response = await fetch('/api/admin/auth?action=login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
    } catch {
      throw new Error('The sign-in service could not be reached. Please try again later.');
    }

    const result = await response.json().catch(() => ({}));
    if (response.status === 401) {
      throw new Error('Those email and password details were not recognised.');
    }
    if (response.status === 429) {
      throw new Error(result?.error?.message ?? 'Too many sign-in attempts. Wait a little and try again.');
    }
    if (!response.ok) throw new Error(result?.error?.message ?? 'The sign-in service could not complete the request. Please try again.');
    const admin = result?.admin ?? { email };
    setAdminSession({ ...admin, email: admin.email ?? email, preview: false });
    navigate('/admin');
  };

  const handlePreviewLogin = () => {
    const previewEmail = 'preview@cornercafe.test';
    sessionStorage.setItem(PREVIEW_SESSION_KEY, previewEmail);
    setAdminSession({ email: previewEmail, role: 'staff', preview: true });
    navigate('/admin');
  };

  const handleSignOut = async () => {
    if (adminSession?.preview) {
      sessionStorage.removeItem(PREVIEW_SESSION_KEY);
    } else if (adminSession) {
      try {
        await fetch('/api/admin/auth?action=logout', { method: 'POST', credentials: 'include' });
      } catch {
        // Clear the local view even if the service is temporarily unavailable.
      }
    }
    setAdminSession(null);
    navigate('/');
  };

  return (
    <div className="app-shell">
      <main className="app-main">
        <Routes>
          <Route
            path="/"
            element={<CafeHome onBook={(intent) => {
              const params = new URLSearchParams({
                date: intent.date,
                time: intent.time,
                partySize: String(intent.partySize),
              });
              navigate(`/reserve?${params.toString()}`);
            }} />}
          />
          <Route
            path="/reserve"
            element={(
              <BookingWizard
                tables={tables}
                onBookingComplete={handleBookingComplete}
                onGoToAdmin={() => navigate('/admin/login')}
                onGoHome={() => navigate('/')}
                initialDate={reservationParams.get('date') ?? undefined}
                initialTime={reservationParams.get('time') ?? undefined}
                initialPartySize={initialPartySize || undefined}
              />
            )}
          />
          <Route
            path="/admin/login"
            element={authLoading
              ? <div className="auth-loading" role="status">Checking staff access…</div>
              : adminSession
                ? <Navigate to="/admin" replace />
                : <AdminLogin onLogin={handleAdminLogin} onPreview={handlePreviewLogin} onBack={() => navigate('/')} />}
          />
          <Route
            path="/admin"
            element={authLoading
              ? <div className="auth-loading" role="status">Checking staff access…</div>
              : adminSession
                ? (
                  <>
                    {adminSession.preview && (
                      <div className="preview-banner" role="status">
                        Sample data preview <span>·</span> Changes are saved in this browser only
                      </div>
                    )}
                    <AdminPanel
                      bookings={bookings}
                      tables={tables}
                      adminEmail={adminSession.email}
                      adminRole={adminSession.role ?? 'staff'}
                      dataError={dashboardError}
                      onUpdateBookingStatus={handleUpdateBookingStatus}
                      onRefresh={async () => {
                        if (adminSession.preview) return;
                        const [reservationResponse, tableResponse] = await Promise.all([
                          fetch('/api/admin/reservations', { credentials: 'include' }),
                          fetch('/api/admin/tables', { credentials: 'include' }),
                        ]);
                        if (!reservationResponse.ok || !tableResponse.ok) throw new Error('Could not refresh the cafe dashboard.');
                        const [reservationData, tableData] = await Promise.all([reservationResponse.json(), tableResponse.json()]);
                        setBookings(reservationData.bookings ?? []);
                        setTables(tableData.tables ?? []);
                      }}
                      onGoToCustomerView={handleSignOut}
                    />
                  </>
                )
                : <Navigate to="/admin/login" replace />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {location.pathname !== '/' && (
        <footer className="app-footer">
          <span className="footer-brand">THE CORNER CAFE</span>
          <span>Reservations made simple</span>
          <span>© {new Date().getFullYear()} The Corner Cafe</span>
        </footer>
      )}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <MainApp />
    </BrowserRouter>
  );
}
