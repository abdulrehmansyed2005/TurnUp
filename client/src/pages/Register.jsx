import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';

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

    // Validation
    if (!form.name || !form.email || !form.password || !form.department || !form.rollNumber) {
      addToast('Please fill in all fields.', 'warning');
      return;
    }

    if (!form.email.endsWith('@lhr.nu.edu.pk')) {
      addToast('Please use your @lhr.nu.edu.pk email.', 'error');
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
      addToast('Account created! Check your email for verification code.', 'success');
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
      <div className="auth-logo">
        <h1>⚽ TurnUp</h1>
        <p>Create your account</p>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
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
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="reg-email">University Email</label>
          <input
            id="reg-email"
            type="email"
            name="email"
            className="form-input"
            placeholder="i220000@lhr.nu.edu.pk"
            value={form.email}
            onChange={handleChange}
          />
          <p className="form-hint">Must be your @lhr.nu.edu.pk email</p>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="reg-department">Department</label>
          <input
            id="reg-department"
            type="text"
            name="department"
            className="form-input"
            placeholder="Computer Science"
            value={form.department}
            onChange={handleChange}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="reg-roll">Roll Number</label>
          <input
            id="reg-roll"
            type="text"
            name="rollNumber"
            className="form-input"
            placeholder="22i-0000"
            value={form.rollNumber}
            onChange={handleChange}
          />
        </div>

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
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary btn-full"
          disabled={loading}
          id="register-submit"
        >
          {loading ? <span className="spinner" /> : null}
          {loading ? 'Creating Account...' : 'Create Account'}
        </button>
      </form>

      <div className="auth-footer">
        Already have an account? <Link to="/login">Log In</Link>
      </div>
    </div>
  );
};

export default Register;
