import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';

const DEPARTMENTS = [
  'Computer Science',
  'Software Engineering',
  'Electrical Engineering',
  'Civil Engineering',
  'Management Sciences',
  'Media Studies',
  'Financial Engineering',
];

const Register = () => {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    department: '',
    rollNumber: '',
  });
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.name || !form.email || !form.password || !form.department || !form.rollNumber) {
      addToast('Please fill in all fields.', 'warning');
      return;
    }

    // Enforce l(2-digit year)(4-digit roll)@lhr.nu.edu.pk
    if (!/^l\d{6}@lhr\.nu\.edu\.pk$/.test(form.email)) {
      addToast('Email must be in the format l240690@lhr.nu.edu.pk', 'error');
      return;
    }

    if (form.password.length < 6) {
      addToast('Password must be at least 6 characters.', 'error');
      return;
    }

    if (form.password !== form.confirmPassword) {
      addToast('Passwords do not match.', 'error');
      return;
    }

    setLoading(true);
    try {
      const { name, email, password, department, rollNumber } = form;
      await register({ name, email, password, department, rollNumber });
      addToast('Account created! Check your email for the verification code.', 'success');
      navigate('/verify-email', { state: { email: form.email } });
    } catch (error) {
      const msg = error.response?.data?.message || 'Registration failed.';
      if (error.response?.data?.requiresVerification) {
        addToast(msg, 'info');
        navigate('/verify-email', { state: { email: form.email } });
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
          <div className="auth-header auth-header-mobile" style={{
            background: 'linear-gradient(135deg, #065f46 0%, #10b981 100%)',
          }}>
            <div className="auth-header-icon">⚽</div>
            <h1 className="auth-header-title">TurnUp</h1>
            <p className="auth-header-sub">FAST NUCES Lahore — Create Your Account</p>
          </div>

          <div className="auth-body">
            <h2 className="auth-form-title">Create Account</h2>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="reg-name">Full Name</label>
                <input
                  id="reg-name"
                  type="text"
                  name="name"
                  className="form-input"
                  placeholder="Ahmed Khan"
                  value={form.name}
                  onChange={handleChange}
                  autoComplete="name"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reg-email">University Email</label>
                <input
                  id="reg-email"
                  type="email"
                  name="email"
                  className="form-input"
                  placeholder="l240690@lhr.nu.edu.pk"
                  value={form.email}
                  onChange={handleChange}
                  autoComplete="email"
                />
                <p className="form-hint">Format: l(year)(roll) e.g. l240690@lhr.nu.edu.pk</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="reg-department">Department</label>
                  <select
                    id="reg-department"
                    name="department"
                    className="form-input"
                    value={form.department}
                    onChange={handleChange}
                  >
                    <option value="">Select dept...</option>
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="reg-roll">Roll Number</label>
                  <input
                    id="reg-roll"
                    type="text"
                    name="rollNumber"
                    className="form-input"
                    placeholder="e.g. 0690"
                    value={form.rollNumber}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 'var(--space-md)' }} />

              <div className="form-group">
                <label className="form-label" htmlFor="reg-password">Password</label>
                <input
                  id="reg-password"
                  type="password"
                  name="password"
                  className="form-input"
                  placeholder="At least 6 characters"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="new-password"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reg-confirm">Confirm Password</label>
                <input
                  id="reg-confirm"
                  type="password"
                  name="confirmPassword"
                  className="form-input"
                  placeholder="Re-enter your password"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  autoComplete="new-password"
                />
              </div>

              <button
                type="submit"
                className="btn btn-full"
                disabled={loading}
                id="register-submit"
                style={{
                  marginTop: 8,
                  background: 'linear-gradient(135deg, #10b981 0%, #065f46 100%)',
                  color: '#fff',
                  boxShadow: '0 4px 14px rgba(16,185,129,0.35)',
                }}
              >
                {loading ? <span className="spinner" /> : null}
                {loading ? 'Creating Account...' : '→ Create Account'}
              </button>
            </form>

            <div className="auth-footer">
              Already have an account? <Link to="/login">Sign In</Link>
            </div>
          </div>
        </div>

        {/* RIGHT — branding panel (desktop only) */}
        <div className="auth-panel-left" style={{
          background: 'linear-gradient(145deg, #065f46 0%, #059669 40%, #10b981 100%)',
          display: 'flex',
        }}>
          <div className="auth-panel-left-inner">
            <div className="auth-panel-logo">⚽</div>
            <h1 className="auth-panel-title">Join TurnUp</h1>
            <p className="auth-panel-sub">FAST NUCES Lahore<br />Futsal Booking Portal</p>

            <div className="auth-panel-features">
              <div className="auth-panel-feature">
                <span className="auth-panel-feature-icon">🎓</span>
                <span>Exclusive for NUCES students</span>
              </div>
              <div className="auth-panel-feature">
                <span className="auth-panel-feature-icon">📅</span>
                <span>Book your slot in seconds</span>
              </div>
              <div className="auth-panel-feature">
                <span className="auth-panel-feature-icon">🔐</span>
                <span>Verified via university email</span>
              </div>
            </div>
          </div>
          <div className="auth-panel-decor" />
        </div>

      </div>
    </div>
  );
};

export default Register;
