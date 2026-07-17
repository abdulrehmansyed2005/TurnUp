import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load user from server on mount (do NOT trust localStorage role — always verify with server)
  useEffect(() => {
    const token = localStorage.getItem('turnup_token');

    if (!token) {
      setLoading(false);
      return;
    }

    // Always fetch fresh user data from the server so the role can't be spoofed via localStorage
    api.get('/auth/me')
      .then((res) => {
        const userData = res.data.user;
        localStorage.setItem('turnup_user', JSON.stringify(userData));
        setUser(userData);
      })
      .catch(() => {
        // Token invalid or expired — clear session
        localStorage.removeItem('turnup_token');
        localStorage.removeItem('turnup_user');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { token, user: userData } = res.data;
    localStorage.setItem('turnup_token', token);
    localStorage.setItem('turnup_user', JSON.stringify(userData));
    setUser(userData);
    return res.data;
  }, []);

  const register = useCallback(async (data) => {
    const res = await api.post('/auth/register', data);
    return res.data;
  }, []);

  const verifyOTP = useCallback(async (email, otp) => {
    const res = await api.post('/auth/verify-otp', { email, otp });
    if (res.data.token) {
      localStorage.setItem('turnup_token', res.data.token);
      localStorage.setItem('turnup_user', JSON.stringify(res.data.user));
      setUser(res.data.user);
    }
    return res.data;
  }, []);

  const resendOTP = useCallback(async (email) => {
    const res = await api.post('/auth/resend-otp', { email });
    return res.data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('turnup_token');
    localStorage.removeItem('turnup_user');
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get('/auth/me');
      const userData = res.data.user;
      localStorage.setItem('turnup_user', JSON.stringify(userData));
      setUser(userData);
    } catch {
      logout();
    }
  }, [logout]);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      isAuthenticated: !!user,
      isAdmin: user?.role === 'admin',
      login,
      register,
      verifyOTP,
      resendOTP,
      logout,
      refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
