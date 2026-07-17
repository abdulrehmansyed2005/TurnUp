import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import api from '../utils/api';

const Home = () => {
  const [slotsData, setSlotsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user, isAdmin } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  // Admins go straight to dashboard
  if (isAdmin) return <Navigate to="/admin" replace />;

  const fetchSlots = useCallback(async () => {
    try {
      const res = await api.get('/bookings/available');
      setSlotsData(res.data);
    } catch (error) {
      addToast('Failed to load slots.', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchSlots();
    const interval = setInterval(fetchSlots, 30000);
    return () => clearInterval(interval);
  }, [fetchSlots]);

  const formatTime = (time24) => {
    const [h, m] = time24.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  const formatDate = (date) =>
    new Date(date).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    });

  const getDayName = () =>
    new Date().toLocaleDateString('en-US', { weekday: 'long' });

  const handleSlotClick = (slot) => {
    if (slot.status !== 'available') return;
    if (slotsData?.userHasActiveBooking) {
      addToast('You already have a booking today.', 'warning');
      return;
    }
    if (slotsData?.userIsLockedOut) {
      addToast('You cancelled too close to slot time. Cannot rebook today.', 'error');
      return;
    }
    navigate(`/book/${slot.startTime}`, {
      state: { slot, turfId: slotsData.turf.id, turfName: slotsData.turf.name },
    });
  };

  if (loading) {
    return (
      <div className="page">
        <div className="loading-container">
          <div className="loading-spinner" />
          <p className="loading-text">Loading today's slots...</p>
        </div>
      </div>
    );
  }

  if (slotsData && !slotsData.isOperatingDay) {
    return (
      <div className="page">
        <div className="weekend-closed">
          <div className="weekend-icon">🏖️</div>
          <h2 className="heading-md">Turf is Closed Today</h2>
          <p className="text-muted">
            The turf operates Monday to Friday.<br />
            Come back on {getDayName() === 'Saturday' ? 'Monday' : 'a weekday'}!
          </p>
        </div>
      </div>
    );
  }

  const canBook = !slotsData?.userHasActiveBooking && !slotsData?.userIsLockedOut;

  return (
    <div className="page home-page">
      {/* Header */}
      <div className="home-header">
        <p className="home-greeting">Hey, {user?.name?.split(' ')[0]} 👋</p>
        <h1 className="home-date">
          <span className="home-day">{getDayName()}</span> Slots
        </h1>
        <p className="home-turf-name">🏟️ {slotsData?.turf?.name || 'Futsal Turf'}</p>
        <p className="text-xs text-muted" style={{ marginTop: 4 }}>
          {slotsData?.date ? formatDate(slotsData.date) : ''}
        </p>
      </div>

      {/* Banners */}
      {slotsData?.userHasActiveBooking && (
        <div className="banner info">
          <span className="banner-icon">📋</span>
          <div>
            <strong>You have a booking today.</strong><br />
            <span style={{ cursor: 'pointer', textDecoration: 'underline' }}
              onClick={() => navigate('/my-bookings')}>
              View your booking →
            </span>
          </div>
        </div>
      )}
      {slotsData?.userIsLockedOut && (
        <div className="banner error">
          <span className="banner-icon">🔒</span>
          <div>
            <strong>Rebooking locked.</strong><br />
            You cancelled within 2 hours of your slot.
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="slot-legend">
        <span className="legend-dot available" />Available
        <span className="legend-dot pending" />Pending
        <span className="legend-dot booked" />Booked
        <span className="legend-dot blocked" />Blocked
      </div>

      {/* Slot schedule */}
      <h2 className="section-title">⚽ Today's Slots</h2>

      <div className="schedule-grid">
        {slotsData?.slots?.map((slot, i) => {
          const isClickable = slot.status === 'available' && canBook;
          return (
            <div
              key={i}
              className={`schedule-row ${slot.status} ${isClickable ? 'clickable' : ''}`}
              id={`slot-${slot.startTime.replace(':', '')}`}
            >
              {/* Time — left column */}
              <div className={`schedule-time schedule-time--${slot.status}`}>
                <span className="schedule-time-start">{formatTime(slot.startTime)}</span>
                <span className="schedule-time-divider">—</span>
                <span className="schedule-time-end">{formatTime(slot.endTime)}</span>
              </div>

              {/* Colored box — right column */}
              <div
                className={`schedule-box ${slot.status}`}
                onClick={() => handleSlotClick(slot)}
                data-clickable={isClickable}
              >
                {slot.status === 'available' && (
                  <>
                    <span className="schedule-box-icon">✓</span>
                    <span className="schedule-box-label">
                      {canBook ? 'Tap to Book' : 'Available'}
                    </span>
                    {canBook && <span className="schedule-box-arrow">→</span>}
                  </>
                )}
                {slot.status === 'pending' && (
                  <>
                    <span className="schedule-box-icon">⏳</span>
                    <span className="schedule-box-team">{slot.teamName}</span>
                    <span className="schedule-box-sublabel">Awaiting approval</span>
                  </>
                )}
                {slot.status === 'booked' && (
                  <>
                    <span className="schedule-box-icon">🏆</span>
                    <span className="schedule-box-team">{slot.teamName}</span>
                    <span className="schedule-box-sublabel">Confirmed</span>
                  </>
                )}
                {slot.status === 'blocked' && (
                  <>
                    <span className="schedule-box-icon">🚫</span>
                    <span className="schedule-box-label">
                      {slot.reason ? `${slot.reason}` : 'Blocked'}
                    </span>
                  </>
                )}
                {slot.status === 'elapsed' && (
                  <>
                    <span className="schedule-box-icon">⏰</span>
                    <span className="schedule-box-label">Elapsed</span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Home;
