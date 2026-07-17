import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyEmail from './pages/VerifyEmail';
import Home from './pages/Home';
import BookSlot from './pages/BookSlot';
import MyBookings from './pages/MyBookings';
import AdminDashboard from './pages/AdminDashboard';
import Profile from './pages/Profile';

// Styles
import './styles/index.css';

const AppRoutes = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-container" style={{ minHeight: '100vh' }}>
        <div className="loading-spinner" />
        <p className="loading-text">Loading TurnUp...</p>
      </div>
    );
  }

  return (
    <>
      <div className="app-container">
        <Routes>
          {/* Public routes */}
          <Route path="/login"        element={isAuthenticated ? <Navigate to="/" /> : <Login />} />
          <Route path="/register"     element={isAuthenticated ? <Navigate to="/" /> : <Register />} />
          <Route path="/verify-email" element={<VerifyEmail />} />

          {/* Protected routes */}
          <Route path="/"            element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/book/:slot"  element={<ProtectedRoute><BookSlot /></ProtectedRoute>} />
          <Route path="/my-bookings" element={<ProtectedRoute><MyBookings /></ProtectedRoute>} />
          <Route path="/profile"     element={<ProtectedRoute><Profile /></ProtectedRoute>} />

          {/* Admin routes */}
          <Route path="/admin" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>

      <Navbar />
    </>
  );
};

const App = () => {
  return (
    <Router>
      <ToastProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ToastProvider>
    </Router>
  );
};

export default App;
