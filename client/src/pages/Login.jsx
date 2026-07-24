import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';

const Login = () => {
  const [mode, setMode] = useState('student'); // 'student' | 'admin'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const isAdmin = mode === 'admin';

  const handleModeSwitch = (newMode) => {
    setMode(newMode);
    setEmail('');
    setPassword('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      addToast('Please fill in all fields.', 'warning');
      return;
    }

    setLoading(true);
    try {
      const data = await login(email, password);
      if (isAdmin && data.user?.role !== 'admin') {
        addToast('Access denied. This portal is for admins only.', 'error');
        return;
      }
      if (!isAdmin && data.user?.role === 'admin') {
        addToast('Please use the Admin portal to log in.', 'warning');
        return;
      }
      addToast(`Welcome back${isAdmin ? ', Admin' : ''}! 🎉`, 'success');
      navigate(isAdmin ? '/admin' : '/');
    } catch (error) {
      const msg = error.response?.data?.message || 'Login failed.';
      if (error.response?.data?.requiresVerification) {
        addToast(msg, 'warning');
        navigate('/verify-email', { state: { email } });
        return;
      }
      addToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-split">

        {/* LEFT — form panel */}
        <div className="auth-panel-right">
          {/* Mobile-only header */}
          <div className="auth-header auth-header-mobile">
            <div className="auth-header-icon">⚽</div>
            <h1 className="auth-header-title">TurnUp</h1>
            <p className="auth-header-sub">FAST NUCES Lahore — Futsal Booking Portal</p>
          </div>

          <div className="auth-body">
            <h2 className="auth-form-title">Sign In</h2>

            {/* Role Toggle */}
            <div className="login-toggle" role="tablist" aria-label="Login type">
              <button
                id="tab-student"
                role="tab"
                aria-selected={!isAdmin}
                className={`login-tab ${!isAdmin ? 'active student' : ''}`}
                onClick={() => handleModeSwitch('student')}
                type="button"
              >
                <span className="login-tab-icon">🎓</span>
                Student
              </button>
              <button
                id="tab-admin"
                role="tab"
                aria-selected={isAdmin}
                className={`login-tab ${isAdmin ? 'active admin' : ''}`}
                onClick={() => handleModeSwitch('admin')}
                type="button"
              >
                <span className="login-tab-icon">⚙️</span>
                Admin
              </button>
            </div>

            {/* Context hint */}
            <p className={`login-hint ${isAdmin ? 'admin' : 'student'}`}>
              {isAdmin
                ? '🔒 Restricted access — authorized personnel only'
                : '👋 Sign in with your NUCES student account'}
            </p>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="login-email">Email</label>
                <input
                  id="login-email"
                  type="email"
                  className={`form-input ${isAdmin ? 'form-input-admin' : ''}`}
                  placeholder={isAdmin ? 'admin@example.com' : 'your-id@lhr.nu.edu.pk'}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="login-password">Password</label>
                <input
                  id="login-password"
                  type="password"
                  className={`form-input ${isAdmin ? 'form-input-admin' : ''}`}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>

              <button
                type="submit"
                className={`btn btn-full ${isAdmin ? 'btn-admin' : 'btn-primary'}`}
                disabled={loading}
                id="login-submit"
                style={{ marginTop: 8 }}
              >
                {loading ? <span className="spinner" /> : null}
                {loading ? 'Signing in...' : isAdmin ? '⚙️ Admin Sign In' : '→ Sign In'}
              </button>
            </form>

            {!isAdmin && (
              <div className="auth-footer">
                Don't have an account? <Link to="/register">Register</Link>
                <span style={{ margin: '0 8px', color: 'var(--text-muted)' }}>·</span>
                <Link to="/forgot-password">Forgot password?</Link>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — branding panel (desktop only) */}
        <div className={`auth-panel-left ${isAdmin ? 'admin' : 'student'}`}>
          <div className="auth-panel-left-inner">
            <div className="auth-panel-logo">⚽</div>
            <h1 className="auth-panel-title">TurnUp</h1>
            <p className="auth-panel-sub">FAST NUCES Lahore<br />Futsal Booking Portal</p>

            <div className="auth-panel-features">
              <div className="auth-panel-feature">
                <span className="auth-panel-feature-icon">📅</span>
                <span>Book slots in seconds</span>
              </div>
              <div className="auth-panel-feature">
                <span className="auth-panel-feature-icon">🔔</span>
                <span>Real-time availability</span>
              </div>
              <div className="auth-panel-feature">
                <span className="auth-panel-feature-icon">⚡</span>
                <span>Instant confirmation</span>
              </div>
            </div>
          </div>
          <div className="auth-panel-decor" />
        </div>

      </div>
    </div>
  );
};

export default Login;
