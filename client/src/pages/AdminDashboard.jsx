import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';
import api from '../utils/api';

// FIX #8: Play a subtle notification sound via Web Audio API (no file needed)
const playNotificationSound = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);
    oscillator.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.4);
  } catch (e) {
    // AudioContext not supported — silently skip
  }
};

const SPORTS = [
  { key: 'all',        label: 'All Sports', icon: '🏅' },
  { key: 'Futsal',     label: 'Futsal',     icon: '⚽' },
  { key: 'Basketball', label: 'Basketball', icon: '🏀' },
];

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [blockedSlots, setBlockedSlots] = useState([]);
  const [turf, setTurf] = useState(null);
  const [allTurfs, setAllTurfs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pending');
  const [sportFilter, setSportFilter] = useState('all');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [actionModal, setActionModal] = useState(null);
  const [adminNote, setAdminNote] = useState('');
  const [processing, setProcessing] = useState(false);
  const [blockForm, setBlockForm] = useState({ turfId: '', startTime: '', endTime: '', reason: '' });
  const [showBlockForm, setShowBlockForm] = useState(false);
  const { addToast } = useToast();
  const prevPendingCount = useRef(null);
  const tabFlashInterval = useRef(null);

  const isToday = selectedDate === new Date().toISOString().slice(0, 10);

  // FIX #8: Request browser notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    return () => {
      if (tabFlashInterval.current) clearInterval(tabFlashInterval.current);
      document.title = 'TurnUp ⚽ — Admin';
    };
  }, []);

  // FIX #8: Flash tab title to draw attention
  const startTabFlash = (count) => {
    if (tabFlashInterval.current) clearInterval(tabFlashInterval.current);
    let toggle = true;
    tabFlashInterval.current = setInterval(() => {
      document.title = toggle
        ? `🔔 ${count} New Booking${count > 1 ? 's' : ''} — TurnUp`
        : 'Admin Dashboard — TurnUp';
      toggle = !toggle;
    }, 1000);
    setTimeout(() => {
      if (tabFlashInterval.current) clearInterval(tabFlashInterval.current);
      document.title = 'TurnUp ⚽ — Admin';
    }, 30000);
  };

  const fetchData = useCallback(async () => {
    try {
      const dateParam = `date=${selectedDate}`;
      const sportParam = sportFilter !== 'all' ? `&sport=${sportFilter}` : '';
      const statusParam = tab !== 'all' ? `&status=${tab}` : '';

      const [statsRes, bookingsRes, turfsRes, blockedRes] = await Promise.all([
        api.get(`/admin/stats?${dateParam}${sportParam}`),
        api.get(`/admin/bookings?${dateParam}${statusParam}${sportParam}`),
        api.get('/turfs'),
        api.get(`/admin/blocked-slots?${dateParam}`),
      ]);

      const newStats = statsRes.data;
      const newPending = newStats.pendingCount || 0;

      // FIX #8: Detect new pending bookings and alert admin
      if (prevPendingCount.current !== null && newPending > prevPendingCount.current) {
        const diff = newPending - prevPendingCount.current;
        playNotificationSound();
        startTabFlash(diff);
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('TurnUp ⚽ — New Booking', {
            body: `${diff} new booking request${diff > 1 ? 's' : ''} waiting for approval.`,
            icon: '/pwa-icon-192.png',
            tag: 'new-booking',
            renotify: true,
          });
        }
      }
      prevPendingCount.current = newPending;

      setStats(newStats);
      setBookings(bookingsRes.data.bookings);
      setBlockedSlots(blockedRes.data.blockedSlots || []);

      const turfs = turfsRes.data.turfs || [];
      setAllTurfs(turfs);
      if (turfs.length > 0) {
        setTurf(turfs[0]);
        // Pre-select turfId for block form if not set
        setBlockForm((f) => ({ ...f, turfId: f.turfId || turfs[0]._id }));
      }
    } catch (error) {
      addToast('Failed to load data.', 'error');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, selectedDate, sportFilter, addToast]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const formatTime = (time24) => {
    const [h, m] = time24.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  const handleAction = async () => {
    if (!actionModal) return;
    setProcessing(true);
    try {
      await api.patch(`/admin/bookings/${actionModal.booking._id}`, {
        status: actionModal.action === 'approve' ? 'approved' : 'rejected',
        adminNote: adminNote.trim() || undefined,
      });
      addToast(
        `Booking ${actionModal.action === 'approve' ? 'approved' : 'rejected'}.`,
        actionModal.action === 'approve' ? 'success' : 'warning'
      );
      fetchData();
    } catch (error) {
      addToast(error.response?.data?.message || 'Action failed.', 'error');
    } finally {
      setProcessing(false);
      setActionModal(null);
      setAdminNote('');
    }
  };

  const handleBlockSlot = async (e) => {
    e.preventDefault();
    if (!blockForm.turfId || !blockForm.startTime || !blockForm.reason) {
      addToast('Please fill in all fields.', 'warning');
      return;
    }
    try {
      await api.post('/admin/block-slot', {
        turfId: blockForm.turfId,
        startTime: blockForm.startTime,
        endTime: blockForm.endTime,
        reason: blockForm.reason,
      });
      addToast('Slot blocked successfully.', 'success');
      setBlockForm((f) => ({ ...f, startTime: '', endTime: '', reason: '' }));
      setShowBlockForm(false);
      fetchData();
    } catch (error) {
      addToast(error.response?.data?.message || 'Failed to block slot.', 'error');
    }
  };

  const handleUnblockSlot = async (slotId) => {
    try {
      await api.delete(`/admin/block-slot/${slotId}`);
      addToast('Slot unblocked successfully.', 'success');
      fetchData();
    } catch (error) {
      addToast(error.response?.data?.message || 'Failed to unblock slot.', 'error');
    }
  };

  // Generate slot options for the selected turf in block form
  const selectedBlockTurf = allTurfs.find((t) => t._id === blockForm.turfId) || turf;
  const slotOptions = (() => {
    if (!selectedBlockTurf) return [];
    const slots = [];
    const [openH] = selectedBlockTurf.openTime.split(':').map(Number);
    const [closeH] = selectedBlockTurf.closeTime.split(':').map(Number);
    const duration = selectedBlockTurf.slotDuration;
    for (let h = openH; h < closeH; h += duration / 60) {
      const start = `${String(h).padStart(2, '0')}:00`;
      const endH = h + duration / 60;
      const end = `${String(endH).padStart(2, '0')}:00`;
      slots.push({ start, end });
    }
    return slots;
  })();

  const statusEmoji = {
    pending: '⏳', approved: '✅', rejected: '❌', cancelled: '🚫', expired: '⌛',
  };

  const sportIcon = (booking) => {
    const sport = booking.turf?.sportTypes?.[0];
    if (sport === 'Basketball') return '🏀';
    return '⚽';
  };

  // Priority badge styling
  const priorityBadge = (pos, total) => {
    if (pos === 1) return { label: '#1 Priority', cls: 'priority-badge priority-1' };
    if (pos === total) return { label: `#${pos} In Queue`, cls: 'priority-badge priority-last' };
    return { label: `#${pos} In Queue`, cls: 'priority-badge priority-n' };
  };

  if (loading) {
    return (
      <div className="page">
        <div className="loading-container">
          <div className="loading-spinner" />
          <p className="loading-text">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <h1 className="heading-md">Admin Dashboard</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            id="admin-date-picker"
            type="date"
            className="form-input"
            style={{ width: 'auto', padding: '7px 12px', fontSize: 'var(--font-sm)' }}
            value={selectedDate}
            onChange={(e) => { setSelectedDate(e.target.value); setTab('pending'); }}
          />
          {!isToday && (
            <button
              className="btn btn-secondary btn-sm"
              id="admin-date-today"
              onClick={() => { setSelectedDate(new Date().toISOString().slice(0, 10)); setTab('pending'); }}
            >
              Today
            </button>
          )}
        </div>
      </div>

      {!isToday && (
        <div className="banner info" style={{ marginBottom: 16 }}>
          <span className="banner-icon">📅</span>
          <span>Viewing bookings for <strong>{new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</strong></span>
        </div>
      )}

      {/* Sport Filter */}
      <div className="sport-tabs" style={{ marginBottom: 16 }}>
        {SPORTS.map((s) => (
          <button
            key={s.key}
            className={`sport-tab ${sportFilter === s.key ? 'active' : ''}`}
            onClick={() => setSportFilter(s.key)}
            id={`admin-sport-${s.key}`}
          >
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats?.pendingCount || 0}</div>
          <div className="stat-label">Pending</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats?.approvedCount || 0}</div>
          <div className="stat-label">Approved</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats?.cancelledCount || 0}</div>
          <div className="stat-label">Cancelled</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats?.rejectedCount || 0}</div>
          <div className="stat-label">Rejected</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats?.todayBookings || 0}</div>
          <div className="stat-label">Total Submitted</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats?.totalUsers || 0}</div>
          <div className="stat-label">Students</div>
        </div>
      </div>

      {/* Block Slot */}
      <div style={{ marginBottom: 16 }}>
        <button
          className="btn btn-secondary btn-full"
          onClick={() => setShowBlockForm(!showBlockForm)}
          id="toggle-block-form"
        >
          {showBlockForm ? '✕ Close' : '🚫 Block a Slot'}
        </button>
      </div>

      {showBlockForm && (
        <form className="block-slot-form" onSubmit={handleBlockSlot}>
          <h3 className="heading-sm" style={{ marginBottom: 16 }}>Block a Slot</h3>

          {/* Turf selector (shows both sports) */}
          {allTurfs.length > 1 && (
            <div className="form-group">
              <label className="form-label" htmlFor="block-turf-select">Sport / Turf</label>
              <select
                id="block-turf-select"
                className="form-input"
                value={blockForm.turfId}
                onChange={(e) => setBlockForm({ ...blockForm, turfId: e.target.value, startTime: '', endTime: '' })}
              >
                {allTurfs.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.sportTypes?.[0] === 'Basketball' ? '🏀' : '⚽'} {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="block-slot-select">Select Slot</label>
            <select
              id="block-slot-select"
              className="form-input"
              value={blockForm.startTime}
              onChange={(e) => {
                const opt = slotOptions.find((s) => s.start === e.target.value);
                setBlockForm({ ...blockForm, startTime: opt?.start || '', endTime: opt?.end || '' });
              }}
            >
              <option value="">Choose a slot...</option>
              {slotOptions.map((s) => (
                <option key={s.start} value={s.start}>
                  {formatTime(s.start)} — {formatTime(s.end)}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="block-reason">Reason (visible to students)</label>
            <input
              id="block-reason"
              type="text"
              className="form-input"
              placeholder="e.g., Court maintenance"
              value={blockForm.reason}
              onChange={(e) => setBlockForm({ ...blockForm, reason: e.target.value })}
            />
          </div>
          <button type="submit" className="btn btn-danger btn-full" id="block-slot-submit">
            Block Slot
          </button>
        </form>
      )}

      {/* Blocked Slots List */}
      {blockedSlots.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h3 className="heading-sm" style={{ marginBottom: 10 }}>🚫 Blocked Slots</h3>
          {blockedSlots.map((slot) => (
            <div key={slot._id} className="admin-booking-card" id={`blocked-slot-${slot._id}`}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div className="admin-booking-time">
                  {slot.turf?.sportTypes?.[0] === 'Basketball' ? '🏀' : '⚽'}{' '}
                  {formatTime(slot.startTime)} — {formatTime(slot.endTime)}
                </div>
                <div className="text-sm text-muted" style={{ marginTop: 4 }}>🔴 {slot.reason}</div>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                id={`unblock-${slot._id}`}
                onClick={() => handleUnblockSlot(slot._id)}
              >
                Unblock
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Status Tabs */}
      <div className="tabs">
        <button className={`tab ${tab === 'pending' ? 'active' : ''}`} onClick={() => setTab('pending')}>
          Pending {stats?.pendingCount > 0 ? `(${stats.pendingCount})` : ''}
        </button>
        <button className={`tab ${tab === 'approved' ? 'active' : ''}`} onClick={() => setTab('approved')}>
          Approved
        </button>
        <button className={`tab ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>
          All
        </button>
      </div>

      {/* Bookings List */}
      {bookings.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <p className="empty-text">No {tab} bookings</p>
        </div>
      ) : (
        bookings.map((booking) => {
          const badge = booking.status === 'pending' && booking.waitlistPosition
            ? priorityBadge(booking.waitlistPosition, booking.slotQueueSize)
            : null;

          return (
            <div key={booking._id} className="admin-booking-card" id={`admin-booking-${booking._id}`}>
              <div className="admin-booking-header">
                <span className="admin-booking-time">
                  {sportIcon(booking)} {formatTime(booking.startTime)} — {formatTime(booking.endTime)}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {badge && (
                    <span className={badge.cls}>{badge.label}</span>
                  )}
                  <span className={`status-badge ${booking.status}`}>
                    {statusEmoji[booking.status]} {booking.status}
                  </span>
                </div>
              </div>

              {/* Queue size indicator for pending slots */}
              {booking.status === 'pending' && booking.slotQueueSize > 1 && (
                <div className="queue-size-info">
                  👥 {booking.slotQueueSize} {booking.slotQueueSize === 1 ? 'request' : 'requests'} for this slot
                </div>
              )}

              <div className="admin-booking-details">
                <div>👤 <strong>{booking.user?.name}</strong> ({booking.user?.rollNumber})</div>
                <div>📧 {booking.user?.email}</div>
                <div>🏢 {booking.user?.department}</div>
                <div>👥 Team: <strong>{booking.teamName}</strong></div>
              </div>

              {booking.status === 'pending' && (
                <div className="admin-actions">
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => setActionModal({ booking, action: 'approve' })}
                    id={`approve-${booking._id}`}
                    style={{ flex: 1 }}
                  >
                    ✅ Approve
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => setActionModal({ booking, action: 'reject' })}
                    id={`reject-${booking._id}`}
                    style={{ flex: 1 }}
                  >
                    ❌ Reject
                  </button>
                </div>
              )}
            </div>
          );
        })
      )}

      {/* Action Modal */}
      <Modal
        isOpen={!!actionModal}
        onClose={() => { setActionModal(null); setAdminNote(''); }}
        title={actionModal?.action === 'approve' ? 'Approve Booking?' : 'Reject Booking?'}
        actions={
          <>
            <button className="btn btn-ghost" onClick={() => { setActionModal(null); setAdminNote(''); }}>
              Cancel
            </button>
            <button
              className={`btn btn-sm ${actionModal?.action === 'approve' ? 'btn-primary' : 'btn-danger'}`}
              onClick={handleAction}
              disabled={processing}
            >
              {processing ? 'Processing...' : actionModal?.action === 'approve' ? 'Approve' : 'Reject'}
            </button>
          </>
        }
      >
        <p style={{ marginBottom: 12 }}>
          {actionModal?.action === 'approve' ? 'Approve' : 'Reject'} booking by{' '}
          <strong>{actionModal?.booking?.user?.name}</strong> for{' '}
          <strong>{actionModal?.booking && formatTime(actionModal.booking.startTime)}</strong>?
        </p>
        {actionModal?.action === 'approve' && actionModal?.booking?.slotQueueSize > 1 && (
          <div className="banner warning" style={{ marginBottom: 12, padding: '10px 12px', fontSize: 'var(--font-xs)' }}>
            <span>⚠️</span>
            <span>
              This slot has <strong>{actionModal.booking.slotQueueSize}</strong> pending requests.
              Approving will auto-reject the others and notify them by email.
            </span>
          </div>
        )}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" htmlFor="admin-note">Note (optional)</label>
          <input
            id="admin-note"
            type="text"
            className="form-input"
            placeholder={actionModal?.action === 'reject' ? 'Reason for rejection...' : 'Any note...'}
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
};

export default AdminDashboard;
