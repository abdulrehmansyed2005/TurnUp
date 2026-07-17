import { useState } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const BookSlot = () => {
  const [teamName, setTeamName] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { isAdmin } = useAuth();

  // Admins cannot book slots
  if (isAdmin) return <Navigate to="/admin" replace />;

  const { slot, turfId, turfName } = location.state || {};

  if (!slot || !turfId) {
    navigate('/');
    return null;
  }

  const formatTime = (time24) => {
    const [h, m] = time24.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!teamName.trim()) {
      addToast('Please enter your team name.', 'warning');
      return;
    }

    setLoading(true);
    try {
      await api.post('/bookings', {
        turfId,
        startTime: slot.startTime,
        endTime: slot.endTime,
        teamName: teamName.trim(),
      });
      setSuccess(true);
    } catch (error) {
      addToast(error.response?.data?.message || 'Booking failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="page">
        <div className="success-animation">
          <div className="success-icon">⚽</div>
          <h2 className="success-title">Booking Submitted!</h2>
          <p className="success-message">
            Your booking for {formatTime(slot.startTime)} — {formatTime(slot.endTime)} is pending admin approval.
          </p>
          <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
            <button
              className="btn btn-primary btn-full"
              onClick={() => navigate('/my-bookings')}
              id="view-bookings-btn"
            >
              View My Bookings
            </button>
            <button
              className="btn btn-secondary btn-full"
              onClick={() => navigate('/')}
              id="back-home-btn"
            >
              Back to Slots
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <button className="btn btn-ghost" onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>
        ← Back
      </button>

      <h1 className="heading-md" style={{ marginBottom: 24 }}>Book a Slot</h1>

      {/* Booking Summary */}
      <div className="booking-summary">
        <div className="booking-summary-title">Booking Summary</div>
        <div className="booking-summary-row">
          <span className="booking-summary-label">Turf</span>
          <span className="booking-summary-value">{turfName}</span>
        </div>
        <div className="booking-summary-row">
          <span className="booking-summary-label">Date</span>
          <span className="booking-summary-value">
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
        </div>
        <div className="booking-summary-row">
          <span className="booking-summary-label">Time</span>
          <span className="booking-summary-value">
            {formatTime(slot.startTime)} — {formatTime(slot.endTime)}
          </span>
        </div>
        <div className="booking-summary-row">
          <span className="booking-summary-label">Sport</span>
          <span className="booking-summary-value">⚽ Futsal</span>
        </div>
      </div>

      {/* Booking Form */}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="team-name">Team Name</label>
          <input
            id="team-name"
            type="text"
            className="form-input"
            placeholder="e.g., FC Thunder"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            maxLength={50}
          />
          <p className="form-hint">This will only be visible to the admin.</p>
        </div>

        <button
          type="submit"
          className="btn btn-primary btn-full"
          disabled={loading}
          id="confirm-booking"
          style={{ marginTop: 8 }}
        >
          {loading ? <span className="spinner" /> : null}
          {loading ? 'Submitting...' : 'Confirm Booking'}
        </button>
      </form>

      <p className="text-xs text-muted text-center" style={{ marginTop: 16 }}>
        Your booking will be pending until the Sports Head approves it.
      </p>
    </div>
  );
};

export default BookSlot;
