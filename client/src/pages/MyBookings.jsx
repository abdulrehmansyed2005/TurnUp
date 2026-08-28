import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';
import api from '../utils/api';

const MyBookings = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('active'); // active | past
  const [cancelModal, setCancelModal] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const { addToast } = useToast();

  const fetchBookings = useCallback(async () => {
    try {
      const res = await api.get('/bookings/my');
      setBookings(res.data.bookings);
    } catch (error) {
      addToast('Failed to load bookings.', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchBookings();
    const interval = setInterval(fetchBookings, 30000);
    return () => clearInterval(interval);
  }, [fetchBookings]);

  const formatTime = (time24) => {
    const [h, m] = time24.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const isToday = (date) => {
    const d = new Date(date);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  };

  const handleCancel = async () => {
    if (!cancelModal) return;
    setCancelling(true);
    try {
      const res = await api.patch(`/bookings/${cancelModal._id}/cancel`);
      addToast(res.data.message, res.data.canRebook ? 'success' : 'warning');
      fetchBookings();
    } catch (error) {
      addToast(error.response?.data?.message || 'Failed to cancel.', 'error');
    } finally {
      setCancelling(false);
      setCancelModal(null);
    }
  };

  // Calculate hours until slot for cancel warning
  const getHoursUntilSlot = (booking) => {
    const now = new Date();
    const [h, m] = booking.startTime.split(':').map(Number);
    const slotMinutes = h * 60 + m;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    return (slotMinutes - currentMinutes) / 60;
  };

  const activeStatuses = ['pending', 'approved'];
  const pastStatuses = ['rejected', 'cancelled', 'expired'];

  const isPastDate = (date) => {
    const bookingDate = new Date(date);
    const today = new Date();
    // Compare date only (strip time)
    bookingDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return bookingDate < today;
  };

  const filteredBookings = bookings.filter((b) => {
    const terminalStatus = pastStatuses.includes(b.status);
    const dateInPast = isPastDate(b.date);
    if (tab === 'active') {
      // Active: pending/approved AND date is today or future
      return activeStatuses.includes(b.status) && !dateInPast;
    } else {
      // Past: terminal status OR date already passed
      return terminalStatus || (activeStatuses.includes(b.status) && dateInPast);
    }
  });

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
          <p className="loading-text">Loading bookings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="heading-md" style={{ marginBottom: 16 }}>My Bookings</h1>

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab ${tab === 'active' ? 'active' : ''}`}
          onClick={() => setTab('active')}
          id="tab-active"
        >
          Active
        </button>
        <button
          className={`tab ${tab === 'past' ? 'active' : ''}`}
          onClick={() => setTab('past')}
          id="tab-past"
        >
          Past
        </button>
      </div>

      {/* Bookings List */}
      {filteredBookings.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">{tab === 'active' ? '📭' : '📜'}</div>
          <p className="empty-text">
            {tab === 'active' ? 'No active bookings' : 'No past bookings'}
          </p>
          <p className="empty-subtext">
            {tab === 'active' ? 'Book a slot from the home page!' : 'Your booking history will appear here.'}
          </p>
        </div>
      ) : (
        filteredBookings.map((booking) => (
          <div key={booking._id} className="booking-card" id={`booking-${booking._id}`}>
            <div className="booking-header">
              <div className="booking-date">
                {isToday(booking.date) ? 'Today' : formatDate(booking.date)}
              </div>
              <span className={`status-badge ${booking.status}`}>
                {statusEmoji[booking.status]} {booking.status}
              </span>
            </div>

            <div className="booking-details">
              <div className="booking-detail-row">
                <span>⏰</span>
                <span>{formatTime(booking.startTime)} — {formatTime(booking.endTime)}</span>
              </div>
              <div className="booking-detail-row">
                <span>🏟️</span>
                <span>
                  {booking.turf?.sportTypes?.[0] === 'Basketball' ? '🏀' : '⚽'}{' '}
                  {booking.turf?.name || 'Futsal Turf'}
                </span>
              </div>
              <div className="booking-detail-row">
                <span>👥</span>
                <span>{booking.teamName}</span>
              </div>
            </div>

            {booking.adminNote && (
              <div className="booking-note">
                <strong>Admin note:</strong> {booking.adminNote}
              </div>
            )}

            {activeStatuses.includes(booking.status) && isToday(booking.date) && (
              <div className="booking-actions">
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => setCancelModal(booking)}
                  id={`cancel-${booking._id}`}
                >
                  Cancel Booking
                </button>
              </div>
            )}
          </div>
        ))
      )}

      {/* Cancel Confirmation Modal */}
      <Modal
        isOpen={!!cancelModal}
        onClose={() => setCancelModal(null)}
        title="Cancel Booking?"
        actions={
          <>
            <button className="btn btn-ghost" onClick={() => setCancelModal(null)}>
              Keep Booking
            </button>
            <button className="btn btn-danger btn-sm" onClick={handleCancel} disabled={cancelling}>
              {cancelling ? 'Cancelling...' : 'Yes, Cancel'}
            </button>
          </>
        }
      >
        <p>
          Are you sure you want to cancel your{' '}
          <strong>{cancelModal && formatTime(cancelModal.startTime)}</strong> slot?
        </p>
        {cancelModal && getHoursUntilSlot(cancelModal) < 2 && (
          <div className="banner warning" style={{ marginTop: 12, padding: 12 }}>
            <span>⚠️</span>
            <span>Less than 2 hours until slot. <strong>You won't be able to rebook today.</strong></span>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default MyBookings;
