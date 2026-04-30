import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } from 'firebase/auth';
import { auth } from '../services/firebase';
import api from '../services/api';
import '../App.css';

const ShieldIcon = () => (
  <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
    <path d="M18 3L5 8v10c0 8 5.5 14.5 13 17 7.5-2.5 13-9 13-17V8L18 3z" fill="#dc2626" opacity=".15"/>
    <path d="M18 3L5 8v10c0 8 5.5 14.5 13 17 7.5-2.5 13-9 13-17V8L18 3z" stroke="#dc2626" strokeWidth="2" strokeLinejoin="round"/>
    <path d="M12 18l4 4 8-8" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const UserIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="5" r="3" stroke="#6b7280" strokeWidth="1.2"/>
    <path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="#6b7280" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);
const EmailIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="1" y="3" width="14" height="10" rx="2" stroke="#6b7280" strokeWidth="1.2"/>
    <path d="M1 5l7 5 7-5" stroke="#6b7280" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);
const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="3" y="7" width="10" height="8" rx="2" stroke="#6b7280" strokeWidth="1.2"/>
    <path d="M5 7V5a3 3 0 016 0v2" stroke="#6b7280" strokeWidth="1.2" strokeLinecap="round"/>
    <circle cx="8" cy="11" r="1.5" fill="#6b7280"/>
  </svg>
);

const Register = () => {
  const [formData, setFormData] = useState({ fullName: '', email: '', password: '', confirmPassword: '' });
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [verificationSent, setVerificationSent] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(p => ({ ...p, [name]: value }));
    if (name === 'password') calcStrength(value);
  };

  const calcStrength = (pw) => {
    let s = 0;
    if (pw.length >= 8)          s++;
    if (/[a-z]/.test(pw))        s++;
    if (/[A-Z]/.test(pw))        s++;
    if (/[0-9]/.test(pw))        s++;
    if (/[^a-zA-Z0-9]/.test(pw)) s++;
    setPasswordStrength(s);
  };

  const strengthColor = () => passwordStrength <= 2 ? '#dc2626' : passwordStrength <= 3 ? '#d97706' : '#16a34a';
  const strengthText  = () => passwordStrength <= 2 ? 'Weak' : passwordStrength <= 3 ? 'Medium' : 'Strong';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess(''); setLoading(true);
    const { fullName, email, password, confirmPassword } = formData;

    if (!fullName || !email || !password || !confirmPassword) {
      setError('Please fill in all fields'); setLoading(false); return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match'); setLoading(false); return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long'); setLoading(false); return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      await updateProfile(user, { displayName: fullName });
      await sendEmailVerification(user);
      setVerificationSent(true);
      await api.post('/signup', { uid: user.uid, email, fullName });
      setSuccess('Account created successfully! Please check your email for verification.');
      setTimeout(() => navigate('/first-key'), 3000);
    } catch (err) {
      const codes = {
        'auth/email-already-in-use': 'This email address is already registered',
        'auth/weak-password':        'The password is too weak',
        'auth/invalid-email':        'Invalid email address',
      };
      setError(codes[err.code] || err.response?.data?.error || 'An error occurred, please try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page dark-auth">
      <div className="auth-container dark-card animate-fade-up">

        <div className="dark-logo-wrap">
          <div className="dark-logo-ring">
            <ShieldIcon />
          </div>
        </div>

        <div className="auth-header" style={{ marginTop: 0 }}>
          <h2 className="dark-title">Create New Account</h2>
          <p className="dark-subtitle">Join and start protecting your data securely</p>
        </div>

        {verificationSent && (
          <div className="dark-info-alert animate-fade-up">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
              <rect x="1" y="3" width="14" height="10" rx="2" stroke="#dc2626" strokeWidth="1.2"/>
              <path d="M1 5l7 5 7-5" stroke="#dc2626" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            Verification link sent to {formData.email}
          </div>
        )}
        {error && (
          <div className="dark-alert-error animate-shake">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
              <circle cx="8" cy="8" r="7" stroke="#dc2626" strokeWidth="1.5"/>
              <path d="M8 4v5M8 11v1" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            {error}
          </div>
        )}
        {success && (
          <div className="dark-success-alert animate-fade-up">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
              <circle cx="8" cy="8" r="7" stroke="#16a34a" strokeWidth="1.5"/>
              <path d="M5 8l2.5 2.5L11 6" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="dark-form-group">
            <label className="dark-label"><UserIcon /> Full Name</label>
            <input type="text" name="fullName" className="dark-input" placeholder="Full Name"
              value={formData.fullName} onChange={handleChange} disabled={loading} required />
          </div>
          <div className="dark-form-group">
            <label className="dark-label"><EmailIcon /> Email Address</label>
            <input type="email" name="email" className="dark-input" placeholder="example@gmail.com"
              value={formData.email} onChange={handleChange} disabled={loading} required />
          </div>
          <div className="dark-form-group">
            <label className="dark-label"><LockIcon /> Password</label>
            <input type="password" name="password" className="dark-input" placeholder="••••••••"
              value={formData.password} onChange={handleChange} disabled={loading} required />
            {formData.password && (
              <div className="dark-strength">
                <div className="dark-strength-bar">
                  <div className="dark-strength-fill" style={{ width: `${(passwordStrength/5)*100}%`, background: strengthColor() }}/>
                </div>
                <span style={{ fontSize: 12, color: strengthColor(), fontWeight: 600 }}>
                  Password Strength: {strengthText()}
                </span>
              </div>
            )}
          </div>
          <div className="dark-form-group">
            <label className="dark-label"><LockIcon /> Confirm Password</label>
            <input type="password" name="confirmPassword" className="dark-input" placeholder="••••••••"
              value={formData.confirmPassword} onChange={handleChange} disabled={loading} required />
            {formData.confirmPassword && formData.password !== formData.confirmPassword && (
              <span style={{ fontSize: 12, color: '#dc2626', marginTop: 4, display: 'block' }}>Passwords do not match</span>
            )}
          </div>
          <div className="dark-check-wrap" style={{ marginBottom: 20 }}>
            <input type="checkbox" required disabled={loading}
              style={{ accentColor: '#dc2626', width: 16, height: 16, flexShrink: 0, marginTop: 2 }} />
            <span className="dark-check-text">
              I agree to the <Link to="/terms" className="dark-link">Terms of Use</Link> and <Link to="/privacy" className="dark-link">Privacy Policy</Link>
            </span>
          </div>
          <button type="submit" className="dark-btn-primary" disabled={loading}>
            {loading ? (
              <><span className="dark-spinner"></span> Creating account...</>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M9 1L3 4v6c0 4.5 2.5 8 6 9.5 3.5-1.5 6-5 6-9.5V4L9 1z" fill="white" opacity=".3"/>
                  <path d="M9 1L3 4v6c0 4.5 2.5 8 6 9.5 3.5-1.5 6-5 6-9.5V4L9 1z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
                  <path d="M6 9l2.5 2.5L12 7" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                Create Account
              </>
            )}
          </button>
        </form>

        <div className="dark-divider"><span>Or</span></div>

        <div className="auth-footer dark-footer">
          <p>Already have an account? <Link to="/login" className="dark-link">Login</Link></p>
          <Link to="/" className="dark-link-secondary">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ marginLeft: 4 }}>
              <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Back to Home
          </Link>
        </div>

        <div className="dark-security-box">
          <div className="dark-security-row">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
              <path d="M7 1L2 3.5v4.5c0 3 2 5.5 5 6.5 3-1 5-3.5 5-6.5V3.5L7 1z" stroke="#dc2626" strokeWidth="1.2" strokeLinejoin="round"/>
            </svg>
            A unique encryption key will be automatically generated for you
          </div>
          <div className="dark-security-row">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
              <rect x="1" y="3" width="12" height="8" rx="2" stroke="#dc2626" strokeWidth="1.2"/>
              <path d="M1 5l6 4 6-4" stroke="#dc2626" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            The encryption key will be sent to your email
          </div>
        </div>

      </div>
    </div>
  );
};

export default Register;