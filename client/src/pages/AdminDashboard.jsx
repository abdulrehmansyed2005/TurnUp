import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';
import api from '../utils/api';

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pending');
  const [actionModal, setActionModal] = useState(null); // { booking, action: 'approve' | 'reject' }
  const [adminNote, setAdminNote] = useState('');
  const [processing, setProcessing] = useState(false);
  const [blockForm, setBlockForm] = useState({ startTime: '', endTime: '', reason: '' });
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [turfId, setTurfId] = useState('');
  const { addToast } = useToast();

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, bookingsRes, turfsRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get(`/admin/bookings${tab !== 'all' ? `?status=${tab}` : ''}`),
        api.get('/turfs'),
      ]);
      setStats(statsRes.data);
      setBookings(bookingsRes.data.bookings);
      if (turfsRes.data.turfs.length > 0) {
        setTurfId(turfsRes.data.turfs[0]._id);
      }
    } catch (error) {
      addToast('Failed to load data.', 'error');
    } finally {
      setLoading(false);
    }
  }, [tab, addToast]);

  useEffect(() => {
    fetchData();
    // Refresh every 15 seconds for admin
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
    if (!blockForm.startTime || !blockForm.reason) {
      addToast('Please fill in all fields.', 'warning');
      return;
    }

    try {
      await api.post('/admin/block-slot', {
        turfId,
        startTime: blockForm.startTime,
        endTime: blockForm.endTime,
        reason: blockForm.reason,
      });
      addToast('Slot blocked successfully.', 'success');
      setBlockForm({ startTime: '', endTime: '', reason: '' });
      setShowBlockForm(false);
      fetchData();
    } catch (error) {
      addToast(error.response?.data?.message || 'Failed to block slot.', 'error');
    }
  };

  // Generate slot options for block form
  const slotOptions = [
    { start: '09:00', end: '10:00' },
    { start: '10:00', end: '11:00' },
    { start: '11:00', end: '12:00' },
    { start: '12:00', end: '13:00' },
    { start: '13:00', end: '14:00' },
    { start: '14:00', end: '15:00' },
    { start: '15:00', end: '16:00' },
    { start: '16:00', end: '17:00' },
  ];

  const statusEmoji = {
    pending: '⏳',
    approved: '✅',
    rejected: '❌',
    cancelled: '🚫',
    expired: '⌛',
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
      <h1 className="heading-md" style={{ marginBottom: 16 }}>Admin Dashboard</h1>

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
          <div className="stat-value">{stats?.todayBookings || 0}</div>
          <div className="stat-label">Total Today</div>
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
              placeholder="e.g., Turf maintenance"
              value={blockForm.reason}
              onChange={(e) => setBlockForm({ ...blockForm, reason: e.target.value })}
            />
          </div>
          <button type="submit" className="btn btn-danger btn-full" id="block-slot-submit">
            Block Slot
          </button>
        </form>
      )}

      {/* Tabs */}
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
        bookings.map((booking) => (
          <div key={booking._id} className="admin-booking-card" id={`admin-booking-${booking._id}`}>
            <div className="admin-booking-header">
              <span className="admin-booking-time">
                {formatTime(booking.startTime)} — {formatTime(booking.endTime)}
              </span>
              <span className={`status-badge ${booking.status}`}>
                {statusEmoji[booking.status]} {booking.status}
              </span>
            </div>

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
        ))
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
