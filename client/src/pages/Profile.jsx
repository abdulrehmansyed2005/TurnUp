import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';

const Profile = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const handleLogout = () => {
    logout();
    addToast('Logged out successfully.', 'info');
    navigate('/login');
  };

  return (
    <div className="page">
      <h1 className="heading-md" style={{ marginBottom: 24 }}>Profile</h1>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'var(--accent-glow)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: 32, margin: '0 auto 12px',
            border: '2px solid var(--accent)'
          }}>
            {user?.name?.[0]?.toUpperCase() || '?'}
          </div>
          <h2 style={{ fontSize: 'var(--font-xl)', fontWeight: 700 }}>{user?.name}</h2>
          <p className="text-sm text-muted" style={{ marginTop: 4 }}>
            {user?.role === 'admin' ? '🔑 Admin' : '🎓 Student'}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="booking-detail-row">
            <span>📧</span>
            <span>{user?.email}</span>
          </div>
          <div className="booking-detail-row">
            <span>🏢</span>
            <span>{user?.department}</span>
          </div>
          <div className="booking-detail-row">
            <span>🎫</span>
            <span>{user?.rollNumber}</span>
          </div>
        </div>
      </div>

      <button
        className="btn btn-danger btn-full"
        onClick={handleLogout}
        id="logout-btn"
      >
        Log Out
      </button>

      <p className="text-xs text-muted text-center" style={{ marginTop: 24 }}>
        TurnUp — FAST NUCES Lahore
      </p>
    </div>
  );
};

export default Profile;
