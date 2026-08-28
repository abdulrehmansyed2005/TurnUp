import { useState } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const SPORT_ICONS = { Futsal: '⚽', Basketball: '🏀' };

const BookSlot = () => {
  const [teamName, setTeamName] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // { waitlistPosition }
  const location = useLocation();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { isAdmin } = useAuth();

  // Admins cannot book slots
  if (isAdmin) return <Navigate to="/admin" replace />;

  const { slot, turfId, turfName, sport } = location.state || {};

  if (!slot || !turfId) {
    navigate('/');
    return null;
  }

  const sportIcon = SPORT_ICONS[sport] || '⚽';

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
      const res = await api.post('/bookings', {
        turfId,
        startTime: slot.startTime,
        endTime: slot.endTime,
        teamName: teamName.trim(),
      });
      setResult({ waitlistPosition: res.data.waitlistPosition });
    } catch (error) {
      addToast(error.response?.data?.message || 'Booking failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── Success / Waitlist Confirmation Screen ──
  if (result) {
    return (
      <div className="page">
        <div className="success-animation">
          <div className="success-icon">{sportIcon}</div>
          <h2 className="success-title">Added to Queue!</h2>

          <p className="success-message">
            Your request for {formatTime(slot.startTime)} — {formatTime(slot.endTime)} has been
            submitted. You&apos;ll receive an email when the admin responds.
          </p>

          <div className="waitlist-info-box">
            <div className="waitlist-info-row">
              <span>{sportIcon}</span>
              <span>{turfName}</span>
            </div>
            <div className="waitlist-info-row">
              <span>🕐</span>
              <span>{formatTime(slot.startTime)} — {formatTime(slot.endTime)}</span>
            </div>
            <div className="waitlist-info-row">
              <span>📧</span>
              <span>You&apos;ll be notified by email when the admin responds</span>
            </div>
          </div>

          <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
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

  // ── Booking Form ──
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
          <span className="booking-summary-label">Sport</span>
          <span className="booking-summary-value">{sportIcon} {sport || 'Futsal'}</span>
        </div>
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
          <p className="form-hint">Shown on the slot board — your identity stays private.</p>
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
        Your booking will be added to the queue. You'll be notified by email when the admin responds.
      </p>
    </div>
  );
};

export default BookSlot;
