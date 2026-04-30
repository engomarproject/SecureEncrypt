import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import '../App.css';

const LockIcon = () => (
  <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="17" width="24" height="18" rx="4" fill="#dc2626"/>
    <path d="M11 17V12a7 7 0 1114 0v5" stroke="#dc2626" strokeWidth="3" strokeLinecap="round"/>
    <circle cx="18" cy="26" r="3" fill="#0a0a0a"/>
    <rect x="17" y="26" width="2" height="5" rx="1" fill="#0a0a0a"/>
  </svg>
);

const EmailIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="1" y="3" width="14" height="10" rx="2" stroke="#6b7280" strokeWidth="1.2"/>
    <path d="M1 5l7 5 7-5" stroke="#6b7280" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);

const PasswordIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="3" y="7" width="10" height="8" rx="2" stroke="#6b7280" strokeWidth="1.2"/>
    <path d="M5 7V5a3 3 0 016 0v2" stroke="#6b7280" strokeWidth="1.2" strokeLinecap="round"/>
    <circle cx="8" cy="11" r="1.5" fill="#6b7280"/>
  </svg>
);

const Login = () => {
  const [email,         setEmail]         = useState('');
  const [password,      setPassword]      = useState('');
  const [error,         setError]         = useState('');
  const [loading,       setLoading]       = useState(false);
  const [showForgot,    setShowForgot]    = useState(false);
  const [resetEmail,    setResetEmail]    = useState('');
  const [resetLoading,  setResetLoading]  = useState(false);
  const [resetMsg,      setResetMsg]      = useState('');
  const [resetError,    setResetError]    = useState('');

  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);

    if (!email || !password) {
      setError('Please enter your email and password');
      setLoading(false); return;
    }

    try {
      await login(email, password);
    } catch (err) {
      const codes = {
        'auth/user-not-found':     'No account found with this email address',
        'auth/wrong-password':     'Incorrect password',
        'auth/invalid-email':      'Invalid email address',
        'auth/too-many-requests':  'Too many attempts. Please try again later.',
        'auth/invalid-credential': 'Incorrect email or password',
      };
      setError(codes[err.code] || 'An error occurred, please try again');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetError(''); setResetMsg(''); setResetLoading(true);

    if (!resetEmail) {
      setResetError('Please enter your email address');
      setResetLoading(false); return;
    }

    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetMsg('✅ Password reset email sent! Check your inbox.');
      setResetEmail('');
    } catch (err) {
      const codes = {
        'auth/user-not-found': 'No account found with this email address',
        'auth/invalid-email':  'Invalid email address',
        'auth/too-many-requests': 'Too many requests. Please try again later.',
      };
      setResetError(codes[err.code] || 'Failed to send reset email. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  /* ── Forgot Password Modal ── */
  if (showForgot) {
    return (
      <div className="auth-page dark-auth">
        <div className="auth-container dark-card animate-fade-up">
          <div className="dark-logo-wrap">
            <div className="dark-logo-ring">
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                <rect x="6" y="17" width="24" height="18" rx="4" fill="#dc2626"/>
                <path d="M11 17V12a7 7 0 1114 0v5" stroke="#dc2626" strokeWidth="3" strokeLinecap="round"/>
              </svg>
            </div>
          </div>

          <div className="auth-header" style={{ marginTop: 0 }}>
            <h2 className="dark-title">Reset Password</h2>
            <p className="dark-subtitle">Enter your email and we'll send you a reset link</p>
          </div>

          {resetError && (
            <div className="dark-alert-error animate-shake">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                <circle cx="8" cy="8" r="7" stroke="#dc2626" strokeWidth="1.5"/>
                <path d="M8 4v5M8 11v1" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              {resetError}
            </div>
          )}

          {resetMsg && (
            <div className="dark-alert-success" style={{
              background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
              borderRadius: 8, padding: '10px 14px', marginBottom: 16,
              color: '#22c55e', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8
            }}>
              {resetMsg}
            </div>
          )}

          <form onSubmit={handleResetPassword} className="auth-form">
            <div className="dark-form-group">
              <label className="dark-label">
                <EmailIcon /> Email Address
              </label>
              <input
                type="email"
                className="dark-input"
                placeholder="example@gmail.com"
                value={resetEmail}
                onChange={e => setResetEmail(e.target.value)}
                disabled={resetLoading}
                required
              />
            </div>

            <button type="submit" className="dark-btn-primary" disabled={resetLoading}>
              {resetLoading ? (
                <><span className="dark-spinner"></span> Sending...</>
              ) : (
                <>📧 Send Reset Link</>
              )}
            </button>
          </form>

          <div className="dark-divider"><span>Or</span></div>

          <div className="auth-footer dark-footer">
            <button
              onClick={() => { setShowForgot(false); setResetMsg(''); setResetError(''); }}
              className="dark-link"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}
            >
              ← Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Main Login Form ── */
  return (
    <div className="auth-page dark-auth">
      <div className="auth-container dark-card animate-fade-up">

        <div className="dark-logo-wrap">
          <div className="dark-logo-ring">
            <LockIcon />
          </div>
        </div>

        <div className="auth-header" style={{ marginTop: 0 }}>
          <h2 className="dark-title">Login</h2>
          <p className="dark-subtitle">Welcome back! Please log in to continue</p>
        </div>

        {error && (
          <div className="dark-alert-error animate-shake">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
              <circle cx="8" cy="8" r="7" stroke="#dc2626" strokeWidth="1.5"/>
              <path d="M8 4v5M8 11v1" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="dark-form-group">
            <label className="dark-label">
              <EmailIcon /> Email Address
            </label>
            <input
              type="email"
              className="dark-input"
              placeholder="example@gmail.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="dark-form-group">
            <label className="dark-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <PasswordIcon /> Password
              </span>
              <button
                type="button"
                onClick={() => setShowForgot(true)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#dc2626', fontSize: 12, fontWeight: 500,
                  textDecoration: 'underline', padding: 0
                }}
              >
                Forgot Password?
              </button>
            </label>
            <input
              type="password"
              className="dark-input"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <button type="submit" className="dark-btn-primary" disabled={loading}>
            {loading ? (
              <><span className="dark-spinner"></span> Logging in...</>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <rect x="2" y="8" width="12" height="9" rx="2" fill="white"/>
                  <path d="M5 8V6a4 4 0 018 0v2" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                  <circle cx="9" cy="12.5" r="1.5" fill="#dc2626"/>
                </svg>
                Login
              </>
            )}
          </button>
        </form>

        <div className="dark-divider"><span>Or</span></div>

        <div className="auth-footer dark-footer">
          <p>Don't have an account? <Link to="/register" className="dark-link">Create a new account</Link></p>
          <Link to="/" className="dark-link-secondary">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ marginLeft: 4 }}>
              <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Back to Home
          </Link>
        </div>

      </div>
    </div>
  );
};

export default Login;