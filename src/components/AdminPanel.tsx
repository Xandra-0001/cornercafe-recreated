import React, { useState } from 'react';
import type { Booking, CafeTable } from '../types';
import { FloorMap } from './FloorMap';
import { AdminTeam } from './AdminTeam';
import {
  Search,
  Clock,
  ListFilter,
  LayoutGrid,
  ArrowLeft
} from 'lucide-react';

interface AdminPanelProps {
  bookings: Booking[];
  tables: CafeTable[];
  adminEmail: string;
  adminRole: 'owner' | 'staff';
  dataError: string | null;
  onRefresh: () => Promise<void>;
  onUpdateBookingStatus: (bookingId: string, newStatus: 'confirmed' | 'pending' | 'cancelled') => void | Promise<void>;
  onGoToCustomerView: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  bookings,
  tables,
  adminEmail,
  adminRole,
  dataError,
  onRefresh,
  onUpdateBookingStatus,
  onGoToCustomerView,
}) => {
  const [activeTab, setActiveTab] = useState<'list' | 'floor'>('list');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'pending' | 'cancelled'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null);
  const [selectedFloorTable, setSelectedFloorTable] = useState<CafeTable | null>(null);
  const [teamOpen, setTeamOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Filter bookings
  const filteredBookings = bookings.filter((b) => {
    if (selectedDate && b.date !== selectedDate) return false;
    if (statusFilter !== 'all' && b.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = b.customerName.toLowerCase().includes(q);
      const matchRef = b.referenceNumber.toLowerCase().includes(q);
      const matchTable = b.table.id.toLowerCase().includes(q);
      return matchName || matchRef || matchTable;
    }
    return true;
  });

  // Today stats
  const totalBookings = bookings.length;
  const confirmedCount = bookings.filter((b) => b.status === 'confirmed').length;
  const pendingCount = bookings.filter((b) => b.status === 'pending').length;
  const totalGuests = bookings.reduce((sum, b) => (b.status !== 'cancelled' ? sum + b.partySize : sum), 0);

  // Map of table id -> booking detail for the floor view
  const tableBookingMap: Record<string, { guestName: string; time: string; party: number }> = {};
  filteredBookings.forEach((b) => {
    if (b.status !== 'cancelled') {
      tableBookingMap[b.table.id] = {
        guestName: b.customerName,
        time: b.timeSlot,
        party: b.partySize,
      };
    }
  });

  return (
    <div className="admin-panel" style={{ maxWidth: '1180px', margin: '0 auto', padding: '24px 16px' }}>
      {/* Top Header */}
      <div className="admin-panel-hero" style={{
        background: 'var(--roast)',
        color: 'var(--cream)',
        borderRadius: '3px',
        padding: '24px',
        marginBottom: '20px',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px'
      }}>
        <div>
          <div className="eyebrow" style={{ color: 'var(--amber)' }}>
            STAFF PORTAL · RESERVATIONS
          </div>
          <h1 className="heading-display" style={{ fontSize: '28px', margin: '4px 0 0' }}>
            Reservations &amp; seating
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--amber)', opacity: 0.85, marginTop: '2px' }}>
            Signed in as {adminEmail} · Review guest requests and manage seating at a glance.
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {adminRole === 'owner' && <button type="button" className="btn btn-ghost" onClick={() => setTeamOpen((open) => !open)}>{teamOpen ? 'Close team access' : 'Team access'}</button>}
          <button type="button" className="btn btn-ghost" disabled={refreshing} onClick={async () => { setRefreshing(true); try { await onRefresh(); } finally { setRefreshing(false); } }}>{refreshing ? 'Refreshing…' : 'Refresh requests'}</button>
          <button type="button" onClick={onGoToCustomerView} className="btn btn-amber" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><ArrowLeft size={14} /> Sign out</button>
        </div>
      </div>

      {dataError && <div className="dashboard-error" role="alert">{dataError}</div>}
      {teamOpen && adminRole === 'owner' && <AdminTeam />}

      {/* Metrics Row */}
      <div className="admin-metrics" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '12px',
        marginBottom: '20px'
      }}>
        <div style={{ background: 'var(--cream)', border: '1px solid var(--border)', padding: '16px', borderRadius: '2px' }}>
          <div className="eyebrow">All reservations</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', fontWeight: 700, color: 'var(--roast)' }}>
            {totalBookings}
          </div>
        </div>
        <div style={{ background: 'var(--cream)', border: '1px solid var(--border)', padding: '16px', borderRadius: '2px' }}>
          <div className="eyebrow">Confirmed</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', fontWeight: 700, color: 'var(--success)' }}>
            {confirmedCount}
          </div>
        </div>
        <div style={{ background: 'var(--cream)', border: '1px solid var(--border)', padding: '16px', borderRadius: '2px' }}>
          <div className="eyebrow">Awaiting review</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', fontWeight: 700, color: 'var(--warning)' }}>
            {pendingCount}
          </div>
        </div>
        <div style={{ background: 'var(--cream)', border: '1px solid var(--border)', padding: '16px', borderRadius: '2px' }}>
          <div className="eyebrow">Guests Expected</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', fontWeight: 700, color: 'var(--roast)' }}>
            {totalGuests}
          </div>
        </div>
      </div>

      {/* Filter and Tab Bar */}
      <div className="admin-toolbar" style={{
        background: 'var(--cream)',
        border: '1.5px solid var(--roast)',
        borderRadius: '3px 3px 0 0',
        padding: '16px 20px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '14px',
        borderBottom: '1px solid var(--border-dk)'
      }}>
        {/* View Switcher Tabs */}
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('list')}
            style={{
              padding: '8px 16px',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              fontWeight: 600,
              border: activeTab === 'list' ? '1.5px solid var(--roast)' : '1px solid var(--border-dk)',
              background: activeTab === 'list' ? 'var(--roast)' : 'var(--cream-alt)',
              color: activeTab === 'list' ? 'var(--cream)' : 'var(--text)',
              borderRadius: '2px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <ListFilter size={14} /> Reservations ({filteredBookings.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('floor')}
            style={{
              padding: '8px 16px',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              fontWeight: 600,
              border: activeTab === 'floor' ? '1.5px solid var(--roast)' : '1px solid var(--border-dk)',
              background: activeTab === 'floor' ? 'var(--roast)' : 'var(--cream-alt)',
              color: activeTab === 'floor' ? 'var(--cream)' : 'var(--text)',
              borderRadius: '2px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <LayoutGrid size={14} /> Seating map
          </button>
        </div>

        {/* Filter Controls */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
          {/* Search */}
          <div style={{ position: 'relative', minWidth: '180px' }}>
            <input
              type="text"
              placeholder="Search name, ref, table..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '28px', fontSize: '12px', padding: '6px 10px 6px 28px' }}
            />
            <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-sec)' }} />
          </div>

          {/* Date selector filter */}
          <div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ fontSize: '12px', padding: '6px 8px' }}
            />
          </div>

          {/* Status selector */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            style={{ fontSize: '12px', padding: '6px 8px' }}
          >
            <option value="all">All Statuses</option>
            <option value="confirmed">Confirmed Only</option>
            <option value="pending">Pending requests</option>
            <option value="cancelled">Cancelled</option>
          </select>

          {(selectedDate || statusFilter !== 'all' || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setSelectedDate('');
                setStatusFilter('all');
                setSearchQuery('');
              }}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: 'var(--danger)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="admin-content" style={{
        background: 'var(--cream)',
        borderLeft: '1.5px solid var(--roast)',
        borderRight: '1.5px solid var(--roast)',
        borderBottom: '1.5px solid var(--roast)',
        borderRadius: '0 0 3px 3px',
        padding: '24px'
      }}>
        {/* TAB 1: BOOKINGS LIST */}
        {activeTab === 'list' && (
          <div>
            {filteredBookings.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-sec)' }}>
                <Clock size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                <h3 className="heading-display" style={{ fontSize: '20px', color: 'var(--roast)' }}>No reservations found</h3>
                <p style={{ fontSize: '12px', marginTop: '4px' }}>
                  Try resetting date or status filters to view the full manifest.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {filteredBookings.map((b) => {
                  const isExpanded = expandedBookingId === b.id;
                  const preOrderSum = b.preOrders.reduce((s, p) => s + p.item.price * p.quantity, 0);

                  return (
                    <div
                      key={b.id}
                      className="booking-request-card"
                      style={{
                        background: 'var(--cream-alt)',
                        border: '1px solid var(--border-dk)',
                        borderRadius: '2px',
                        padding: '16px 20px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        transition: 'border-color 0.15s ease'
                      }}
                    >
                      {/* Booking Card Header Row */}
                      <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '12px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 700,
                            fontSize: '13px',
                            background: 'var(--roast)',
                            color: 'var(--cream)',
                            padding: '3px 8px',
                            borderRadius: '1px'
                          }}>
                            {b.referenceNumber}
                          </span>

                          <div>
                            <span style={{ fontFamily: 'var(--font-body)', fontSize: '16px', fontWeight: 700, color: 'var(--roast)' }}>
                              {b.customerName}
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--text-sec)', marginLeft: '8px' }}>
                              ({b.partySize} {b.partySize === 1 ? 'Guest' : 'Guests'})
                            </span>
                          </div>
                        </div>

                        {/* Status badge + actions */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span className={`badge badge-${b.status}`}>
                            {b.status}
                          </span>

                          {/* Quick status actions */}
                          {b.status !== 'confirmed' && (
                            <button
                              type="button"
                              onClick={() => onUpdateBookingStatus(b.id, 'confirmed')}
                              title="Mark Confirmed"
                              style={{
                                background: '#d4edda',
                                color: 'var(--success)',
                                border: '1px solid #c3e6cb',
                                borderRadius: '2px',
                                padding: '4px 8px',
                                fontSize: '10px',
                                cursor: 'pointer'
                              }}
                            >
                              Confirm
                            </button>
                          )}
                          {b.status !== 'cancelled' && (
                            <button
                              type="button"
                              onClick={() => onUpdateBookingStatus(b.id, 'cancelled')}
                              title="Cancel Reservation"
                              style={{
                                background: '#f8d7da',
                                color: 'var(--danger)',
                                border: '1px solid #f5c6cb',
                                borderRadius: '2px',
                                padding: '4px 8px',
                                fontSize: '10px',
                                cursor: 'pointer'
                              }}
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Booking meta details row */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: '12px',
                        fontSize: '12px',
                        borderTop: '1px solid var(--border)',
                        paddingTop: '10px'
                      }}>
                        <div>
                          <span className="eyebrow" style={{ display: 'block' }}>Date &amp; Slot</span>
                          <strong>{b.date}</strong> at <strong>{b.timeSlot}</strong>
                        </div>
                        <div>
                          <span className="eyebrow" style={{ display: 'block' }}>Floor Table</span>
                          <strong>Table {b.table.id}</strong> ({b.table.zone} · {b.table.capacity}-top)
                        </div>
                        <div>
                          <span className="eyebrow" style={{ display: 'block' }}>Guest Contact</span>
                          <span>{b.customerPhone || b.customerEmail || 'Walk-in Guest'}</span>
                        </div>
                        <div>
                          <span className="eyebrow" style={{ display: 'block' }}>Pre-Orders</span>
                          <span>
                            {b.preOrders.length > 0 ? (
                              <button
                                type="button"
                                onClick={() => setExpandedBookingId(isExpanded ? null : b.id)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--amber-dk)',
                                  textDecoration: 'underline',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  padding: 0
                                }}
                              >
                                {b.preOrders.reduce((s, p) => s + p.quantity, 0)} items (${preOrderSum.toFixed(2)}) {isExpanded ? '▲' : '▼'}
                              </button>
                            ) : (
                              'None'
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Expandable Pre-Orders and Notes */}
                      {isExpanded && b.preOrders.length > 0 && (
                        <div style={{
                          background: 'var(--cream)',
                          border: '1px solid var(--border)',
                          borderRadius: '2px',
                          padding: '12px',
                          marginTop: '4px'
                        }}>
                          <div className="eyebrow" style={{ marginBottom: '6px' }}>Barista Pre-Order Items:</div>
                          {b.preOrders.map((p) => (
                            <div key={p.item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', padding: '3px 0' }}>
                              <span>{p.quantity}x {p.item.name} ({p.item.category})</span>
                              <span>${(p.item.price * p.quantity).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {b.specialRequests && (
                        <div style={{ fontSize: '11px', color: 'var(--text-sec)', background: 'var(--cream)', padding: '6px 10px', borderRadius: '2px' }}>
                          <strong>Guest Note:</strong> {b.specialRequests}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: LIVE FLOOR STATUS VIEW */}
        {activeTab === 'floor' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <div className="eyebrow">FLOOR SEATING MANIFEST</div>
                <h3 className="heading-display" style={{ fontSize: '22px', color: 'var(--roast)' }}>
                  Live seating map
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-sec)' }}>
                  Select a table to see its reservation details.
                </p>
              </div>

              {selectedDate && (
                <div style={{ fontSize: '12px', color: 'var(--amber-dk)', fontWeight: 600 }}>
                  Filtering by date: {selectedDate}
                </div>
              )}
            </div>

            <FloorMap
              tables={tables}
              selectedTableId={selectedFloorTable?.id || null}
              onSelectTable={(t) => setSelectedFloorTable(t)}
              tableBookingMap={tableBookingMap}
            />

            {/* Selected Table Booking Inspector Drawer */}
            {selectedFloorTable && (
              <div style={{
                background: 'var(--cream-alt)',
                border: '1.5px solid var(--roast)',
                borderRadius: '2px',
                padding: '20px',
                marginTop: '10px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span className="badge badge-confirmed" style={{ marginBottom: '6px' }}>
                      INSPECTOR · TABLE {selectedFloorTable.id}
                    </span>
                    <h4 className="heading-display" style={{ fontSize: '20px', color: 'var(--roast)', margin: '2px 0' }}>
                      {selectedFloorTable.zone} Section · Max {selectedFloorTable.capacity} Guests
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedFloorTable(null)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-sec)', cursor: 'pointer', fontSize: '16px' }}
                  >
                    ✕
                  </button>
                </div>

                {/* Check if table has a reservation */}
                {(() => {
                  const booking = filteredBookings.find((b) => b.table.id === selectedFloorTable.id && b.status !== 'cancelled');
                  if (!booking) {
                    return (
                      <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text-sec)' }}>
                        ✓ No active bookings allocated to Table {selectedFloorTable.id} for the current date scope. Available for walk-ins.
                      </div>
                    );
                  }

                  return (
                    <div style={{ marginTop: '14px', borderTop: '1px dashed var(--border-dk)', paddingTop: '12px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', fontSize: '12px' }}>
                        <div>
                          <div className="eyebrow">Guest</div>
                          <strong>{booking.customerName}</strong> ({booking.partySize} Guests)
                        </div>
                        <div>
                          <div className="eyebrow">Time &amp; Request ref</div>
                          <strong>{booking.timeSlot}</strong> · {booking.referenceNumber}
                        </div>
                        <div>
                          <div className="eyebrow">Contact</div>
                          <span>{booking.customerPhone || booking.customerEmail}</span>
                        </div>
                        <div>
                          <div className="eyebrow">Status</div>
                          <span className={`badge badge-${booking.status}`}>{booking.status}</span>
                        </div>
                      </div>

                      {booking.preOrders.length > 0 && (
                        <div style={{ marginTop: '10px', fontSize: '11px', background: 'var(--cream)', padding: '8px 12px', borderRadius: '2px' }}>
                          <span style={{ fontWeight: 600 }}>Pre-Order Items:</span>{' '}
                          {booking.preOrders.map((p) => `${p.quantity}x ${p.item.name}`).join(', ')}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
