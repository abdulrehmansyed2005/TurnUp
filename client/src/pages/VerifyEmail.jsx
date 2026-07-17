import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import OtpInput from '../components/OtpInput';

const VerifyEmail = () => {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const { verifyOTP, resendOTP } = useAuth();
  const { addToast } = useToast();

  const email = location.state?.email;

  useEffect(() => {
    if (!email) {
      navigate('/register');
    }
  }, [email, navigate]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleVerify = async () => {
    if (otp.length !== 6) {
      addToast('Please enter the 6-digit code.', 'warning');
      return;
    }

    setLoading(true);
    try {
      await verifyOTP(email, otp);
      addToast('Email verified! Welcome to TurnUp! 🎉', 'success');
      navigate('/');
    } catch (error) {
      addToast(error.response?.data?.message || 'Verification failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;

    try {
      await resendOTP(email);
      addToast('New code sent to your email.', 'success');
      setResendCooldown(60);
      setOtp('');
    } catch (error) {
      addToast(error.response?.data?.message || 'Failed to resend.', 'error');
    }
  };

  if (!email) return null;

  return (
    <div className="auth-page">
      <div className="auth-logo">
        <h1>📧</h1>
        <p style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: 8 }}>
          Verify Your Email
        </p>
      </div>

      <div className="auth-form" style={{ textAlign: 'center' }}>
        <p className="text-muted" style={{ marginBottom: 8 }}>
          We sent a 6-digit code to
        </p>
        <p style={{ fontWeight: 600, color: 'var(--accent)', marginBottom: 24 }}>
          {email}
        </p>

        <OtpInput length={6} value={otp} onChange={setOtp} />

        <button
          className="btn btn-primary btn-full"
          onClick={handleVerify}
          disabled={loading || otp.length !== 6}
          id="verify-submit"
          style={{ marginTop: 16 }}
        >
          {loading ? <span className="spinner" /> : null}
          {loading ? 'Verifying...' : 'Verify Email'}
        </button>

        <div style={{ marginTop: 24 }}>
          <button
            className="btn btn-ghost"
            onClick={handleResend}
            disabled={resendCooldown > 0}
            id="resend-otp"
          >
            {resendCooldown > 0
              ? `Resend in ${resendCooldown}s`
              : 'Resend Code'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
