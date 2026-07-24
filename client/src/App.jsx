import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyEmail from './pages/VerifyEmail';
import ForgotPassword from './pages/ForgotPassword';
import Home from './pages/Home';
import BookSlot from './pages/BookSlot';
import MyBookings from './pages/MyBookings';
import AdminDashboard from './pages/AdminDashboard';
import Profile from './pages/Profile';

// Styles
import './styles/index.css';

// Layout wrapper for authenticated app pages (sidebar + content)
const AppLayout = () => (
  <>
    <div className="app-container">
      <Outlet />
    </div>
    <Navbar />
  </>
);

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
    <Routes>
      {/* Auth routes — full-screen, outside app-container */}
      <Route path="/login"          element={isAuthenticated ? <Navigate to="/" /> : <Login />} />
      <Route path="/register"       element={isAuthenticated ? <Navigate to="/" /> : <Register />} />
      <Route path="/verify-email"   element={<VerifyEmail />} />
      <Route path="/forgot-password" element={isAuthenticated ? <Navigate to="/" /> : <ForgotPassword />} />

      {/* App routes — inside AppLayout (sidebar + app-container) */}
      <Route element={<AppLayout />}>
        <Route path="/"            element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/book/:slot"  element={<ProtectedRoute><BookSlot /></ProtectedRoute>} />
        <Route path="/my-bookings" element={<ProtectedRoute><MyBookings /></ProtectedRoute>} />
        <Route path="/profile"     element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/admin"       element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
        <Route path="*"            element={<Navigate to="/" />} />
      </Route>
    </Routes>
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
