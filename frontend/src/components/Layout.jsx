import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { signOut } from 'firebase/auth';
import { auth } from '../services/firebase';
import './Layout.css';

// ====== Theme Toggle Button ======
const ThemeToggle = () => {
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem('theme') === 'dark' ||
      (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  return (
    <button
      className="theme-toggle"
      onClick={() => setIsDark(d => !d)}
      aria-label="Toggle theme"
      title={isDark ? 'Light mode' : 'Dark mode'}
    >
      <span className="theme-icon">{isDark ? '☀️' : '🌙'}</span>
      <span className="theme-label">{isDark ? 'Light' : 'Dark'}</span>
    </button>
  );
};

// ====== Navbar ======
const Navbar = () => {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (err) {
      console.error('Logout Error:', err);
    }
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        {/* Logo */}
        <Link to="/" className="navbar-logo">
          <div className="navbar-logo-icon">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="3" y="9" width="14" height="10" rx="3" fill="#dc2626"/>
              <path d="M6 9V6a4 4 0 018 0v3" stroke="#dc2626" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="10" cy="14" r="1.5" fill="#0d0d0d"/>
            </svg>
          </div>
          <span className="logo-text">
            <span className="logo-title">SecureEncrypt</span>
          </span>
        </Link>

        {/* Desktop Links */}
        <div className={`navbar-links ${menuOpen ? 'open' : ''}`}>
          {isAuthenticated && user ? (
            <>
              <Link
                to="/dashboard"
                className={`nav-link ${location.pathname === '/dashboard' ? 'active' : ''}`}
                onClick={() => setMenuOpen(false)}
              >
                📊 Dashboard
              </Link>
              <Link
                to="/profile"
                className={`nav-link ${location.pathname === '/profile' ? 'active' : ''}`}
                onClick={() => setMenuOpen(false)}
              >
                👤 My Account
              </Link>
              <ThemeToggle />
              <div className="user-menu">
                <span className="user-email">{user.email}</span>
                <button onClick={handleLogout} className="btn-logout">
                  🚪 Logout
                </button>
              </div>
            </>
          ) : (
            <>
              <Link
                to="/"
                className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
                onClick={() => setMenuOpen(false)}
              >
                🏠 Home
              </Link>
              <Link
                to="/login"
                className={`nav-link ${location.pathname === '/login' ? 'active' : ''}`}
                onClick={() => setMenuOpen(false)}
              >
                🔑 Login
              </Link>
              <Link
                to="/register"
                className="btn-register"
                onClick={() => setMenuOpen(false)}
              >
                 Create Account
              </Link>
              <ThemeToggle />
            </>
          )}
        </div>

        {/* Mobile Toggle */}
        <button
          className={`navbar-toggle ${menuOpen ? 'open' : ''}`}
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
    </nav>
  );
};

// ====== Footer ======
const Footer = () => {
  const currentYear = new Date().getFullYear();
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-main">
          <div className="footer-section">
            <h3 className="footer-title">🔒 SecureEncrypt</h3>
            <p className="footer-description">
              A secure web tool for encrypting and decrypting data using the advanced Fernet algorithm.
            </p>
            <div className="footer-features">
              <span className="feature-tag">🛡️ Strong Encryption</span>
              <span className="feature-tag">🌐 Web Interface</span>
              <span className="feature-tag">🔐 Secure Keys</span>
            </div>
          </div>

          <div className="footer-section">
            <h3 className="footer-title">Quick Links</h3>
            <ul className="footer-links">
              <li><Link to="/">🏠 Home</Link></li>
              <li><Link to="/login">🔑 Login</Link></li>
              <li><Link to="/register"> Create Account</Link></li>
              <li><Link to="/dashboard">📊 Dashboard</Link></li>
            </ul>
          </div>
        </div>

        <div className="footer-divider"></div>

        <div className="footer-bottom">
          <div className="copyright">
            <p>&copy; {currentYear} SecureEncrypt. All rights reserved.</p>
          </div>
          <div className="footer-social">
            <div className="social-icons">
              <a href="#" className="social-icon" aria-label="GitHub">💻</a>
              <a href="#" className="social-icon" aria-label="Email">📧</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

// ====== Layout ======
const Layout = ({ children }) => {
  return (
    <div className="layout-wrapper">
      <Navbar />
      <main className="main-content">
        {children}
      </main>
      <Footer />
    </div>
  );
};

export default Layout;