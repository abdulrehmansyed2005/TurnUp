import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import OtpInput from '../components/OtpInput';
import api from '../utils/api';

const ForgotPassword = () => {
  const [step, setStep] = useState('email'); // 'email' | 'reset'
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();
  const navigate = useNavigate();

  const handleSendCode = async (e) => {
    e.preventDefault();
    if (!email) { addToast('Please enter your email.', 'warning'); return; }

    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      addToast('Reset code sent! Check your email.', 'success');
      setStep('reset');
    } catch (error) {
      addToast(error.response?.data?.message || 'Failed to send reset code.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    if (otp.length < 6) { addToast('Please enter the 6-digit code.', 'warning'); return; }
    if (!newPassword) { addToast('Please enter a new password.', 'warning'); return; }
    if (newPassword.length < 6) { addToast('Password must be at least 6 characters.', 'error'); return; }
    if (newPassword !== confirmPassword) { addToast('Passwords do not match.', 'error'); return; }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { email, otp, newPassword });
      addToast('Password reset! You can now log in.', 'success');
      navigate('/login');
    } catch (error) {
      addToast(error.response?.data?.message || 'Reset failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-split">

        {/* Form panel */}
        <div className="auth-panel-right">
          {/* Mobile header */}
          <div className="auth-header auth-header-mobile">
            <div className="auth-header-icon">⚽</div>
            <h1 className="auth-header-title">TurnUp</h1>
            <p className="auth-header-sub">FAST NUCES Lahore — Reset Your Password</p>
          </div>

          <div className="auth-body">
            <h2 className="auth-form-title">
              {step === 'email' ? '🔑 Forgot Password' : '🔒 Reset Password'}
            </h2>

            {step === 'email' ? (
              <form onSubmit={handleSendCode}>
                <p className="text-sm text-muted" style={{ textAlign: 'center', marginBottom: 24 }}>
                  Enter your university email and we'll send a 6-digit reset code.
                </p>
                <div className="form-group">
                  <label className="form-label" htmlFor="forgot-email">University Email</label>
                  <input
                    id="forgot-email"
                    type="email"
                    className="form-input"
                    placeholder="i220000@lhr.nu.edu.pk"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary btn-full"
                  disabled={loading}
                  id="send-reset-code"
                  style={{ marginTop: 8 }}
                >
                  {loading ? <span className="spinner" /> : null}
                  {loading ? 'Sending...' : 'Send Reset Code'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleReset}>
                <p className="text-sm text-muted" style={{ textAlign: 'center', marginBottom: 8 }}>
                  Enter the 6-digit code sent to <strong>{email}</strong>
                </p>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ display: 'block', margin: '0 auto 20px', fontSize: 'var(--font-xs)' }}
                  onClick={() => setStep('email')}
                >
                  ← Change email
                </button>

                <OtpInput value={otp} onChange={setOtp} />

                <div className="form-group" style={{ marginTop: 8 }}>
                  <label className="form-label" htmlFor="new-password">New Password</label>
                  <input
                    id="new-password"
                    type="password"
                    className="form-input"
                    placeholder="At least 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="confirm-new-password">Confirm Password</label>
                  <input
                    id="confirm-new-password"
                    type="password"
                    className="form-input"
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-full"
                  disabled={loading}
                  id="reset-password-submit"
                  style={{ marginTop: 8 }}
                >
                  {loading ? <span className="spinner" /> : null}
                  {loading ? 'Resetting...' : '→ Reset Password'}
                </button>
              </form>
            )}

            <div className="auth-footer">
              Remembered it? <Link to="/login">Sign In</Link>
            </div>
          </div>
        </div>

        {/* Branding panel (desktop) */}
        <div className="auth-panel-left" style={{
          background: 'linear-gradient(145deg, #1e1b4b 0%, #3730a3 50%, #4f46e5 100%)',
          display: 'flex',
        }}>
          <div className="auth-panel-left-inner">
            <div className="auth-panel-logo">🔑</div>
            <h1 className="auth-panel-title">Recover Access</h1>
            <p className="auth-panel-sub">TurnUp — FAST NUCES<br />We'll get you back in</p>

            <div className="auth-panel-features">
              <div className="auth-panel-feature">
                <span className="auth-panel-feature-icon">📧</span>
                <span>Code sent to your university email</span>
              </div>
              <div className="auth-panel-feature">
                <span className="auth-panel-feature-icon">⏱️</span>
                <span>Code valid for 10 minutes</span>
              </div>
              <div className="auth-panel-feature">
                <span className="auth-panel-feature-icon">🔒</span>
                <span>Your data stays secure</span>
              </div>
            </div>
          </div>
          <div className="auth-panel-decor" />
        </div>

      </div>
    </div>
  );
};

export default ForgotPassword;
