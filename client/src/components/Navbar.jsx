import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { isAuthenticated, isAdmin } = useAuth();

  if (!isAuthenticated) return null;

  return (
    <nav className="navbar">
      {/* Brand — visible only on desktop sidebar */}
      <div className="navbar-brand">
        <span>⚽</span>
        <span>TurnUp</span>
      </div>

      <div className="navbar-inner">
        {!isAdmin && (
          <>
            <NavLink
              to="/"
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              end
            >
              <span className="nav-icon">🏟️</span>
              <span>Slots</span>
            </NavLink>

            <NavLink
              to="/my-bookings"
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon">📋</span>
              <span>Bookings</span>
            </NavLink>
          </>
        )}

        {isAdmin && (
          <NavLink
            to="/admin"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon">⚙️</span>
            <span>Dashboard</span>
          </NavLink>
        )}

        <NavLink
          to="/profile"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <span className="nav-icon">👤</span>
          <span>Profile</span>
        </NavLink>
      </div>
    </nav>
  );
};

export default Navbar;

