import { useEffect, useState, type FormEvent } from 'react';
import { UserPlus, UserRoundX } from 'lucide-react';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'staff';
  isActive: boolean;
  createdAt: string;
}

export function AdminTeam() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/users', { credentials: 'include' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error?.message ?? 'Could not load team accounts.');
      setAdmins(result.admins ?? []);
      setMessage(null);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Could not load team accounts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const addAdmin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role: 'staff' }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error?.message ?? 'Could not add this staff account.');
      setAdmins((previous) => [...previous, result.admin]);
      setName(''); setEmail(''); setPassword('');
      setMessage('Staff account created. Share its email and temporary password securely.');
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Could not add this staff account.');
    } finally {
      setSaving(false);
    }
  };

  const toggleAdmin = async (admin: AdminUser) => {
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/user?id=${encodeURIComponent(admin.id)}`, {
        method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !admin.isActive }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error?.message ?? 'Could not update this account.');
      setAdmins((previous) => previous.map((item) => item.id === admin.id ? result.admin : item));
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Could not update this account.');
    }
  };

  return (
    <section className="team-management" aria-labelledby="team-title">
      <div className="team-management-heading">
        <div><p className="eyebrow">OWNER CONTROLS</p><h3 id="team-title">Team access</h3></div>
        <p>Create separate sign-ins for each staff member. Deactivated accounts lose access immediately.</p>
      </div>
      <form className="team-add-form" onSubmit={addAdmin}>
        <label>Name<input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={100} required /></label>
        <label>Work email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <label>Initial password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={12} maxLength={128} required /></label>
        <button className="btn btn-primary" type="submit" disabled={saving}><UserPlus size={15} /> {saving ? 'Adding…' : 'Add staff'}</button>
      </form>
      {message && <p className="team-message" role="status">{message}</p>}
      {loading ? <p className="team-message">Loading team accounts…</p> : (
        <div className="team-user-list">
          {admins.map((admin) => (
            <div className="team-user-row" key={admin.id}>
              <div><strong>{admin.name}</strong><span>{admin.email} · {admin.role}</span></div>
              <span className={`team-status ${admin.isActive ? 'active' : 'inactive'}`}>{admin.isActive ? 'Active' : 'Inactive'}</span>
              {admin.role !== 'owner' && <button type="button" className="team-disable" onClick={() => void toggleAdmin(admin)}><UserRoundX size={14} /> {admin.isActive ? 'Deactivate' : 'Reactivate'}</button>}
            </div>
          ))}
          <button type="button" className="team-refresh" onClick={() => void load()}>Refresh team list</button>
        </div>
      )}
    </section>
  );
}
