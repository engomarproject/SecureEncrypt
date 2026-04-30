import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import '../App.css';

/**
 * مكون عرض مفتاح التشفير الأول (First Key Display Component)
 * 
 * الوظيفة:
 * - عرض مفتاح التشفير الفريد للمستخدم لأول مرة بعد التسجيل
 * - تنبيه المستخدم بأهمية حفظ المفتاح لأنه لا يظهر مرة أخرى
 * - توفير خيار نسخ المفتاح والتحقق من فهم المستخدم للمسؤولية
 * - توجيه المستخدم إلى لوحة التحكم بعد الإقرار
 */
const FirstKeyDisplay = () => {
  const navigate       = useNavigate();
  const { user }       = useAuth();
  const [encryptionKey, setEncryptionKey] = useState('');
  const [loading,       setLoading]       = useState(true);
  const [copied,        setCopied]        = useState(false);
  const [acknowledged,  setAcknowledged]  = useState(false);

  // جلب مفتاح التشفير عند تحميل المكون
  useEffect(() => {
    fetchUserKey();
  }, []);

  /**
   * جلب مفتاح التشفير الخاص بالمستخدم من الخادم
   */
  const fetchUserKey = async () => {
    try {
      const response = await api.get('/user/key');
      if (response.data.success) {
        setEncryptionKey(response.data.data.key);
      }
    } catch (err) {
      console.error('Failed to fetch key:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * نسخ المفتاح إلى الحافظة
   */
  const copyToClipboard = () => {
    navigator.clipboard.writeText(encryptionKey).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // عرض حالة التحميل
  if (loading) {
    return (
      <div className="auth-page dark-auth">
        <div className="auth-container dark-card" style={{ textAlign: 'center' }}>
          <div className="dark-logo-wrap">
            <div className="dark-logo-ring">
              <KeyIcon />
            </div>
          </div>
          <div className="dark-spinner-lg" style={{ margin: '8px auto 20px' }}></div>
          <p className="dark-subtitle">Loading encryption key...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page dark-auth">
      <div className="auth-container dark-card key-display-container animate-fade-up">

        {/* Logo - شعار الصفحة */}
        <div className="dark-logo-wrap">
          <div className="dark-logo-ring dark-logo-pulse">
            <KeyIcon />
          </div>
        </div>

        <div className="auth-header" style={{ marginTop: 0 }}>
          <h2 className="dark-title">Your Encryption Key</h2>
          <p className="dark-subtitle">This key will be shown only once</p>
        </div>

        {/* Warning Box - صندوق التحذير */}
        <div className="dark-warn-box">
          <WarningIcon />
          <div>
            <p style={{ color: '#fca5a5', fontWeight: 600, marginBottom: 6 }}>Important Warning</p>
            <ul className="dark-warn-list">
              <li>Save this key in a very secure place</li>
              <li>Without this key, your data can never be decrypted</li>
              <li>A copy has been sent to your email address</li>
            </ul>
          </div>
        </div>

        {/* Key Box - صندوق عرض المفتاح */}
        <div className="dark-key-box">
          <div className="dark-key-label">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ marginLeft: 6 }}>
              <circle cx="4" cy="4" r="3" stroke="#dc2626" strokeWidth="1.2"/>
              <line x1="6.5" y1="6.5" x2="11" y2="11" stroke="#dc2626" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            Fernet Key
          </div>
          <div className="dark-key-value">
            {encryptionKey}
          </div>
          <button
            onClick={copyToClipboard}
            className={`dark-copy-btn ${copied ? 'copied' : ''}`}
          >
            <CopyIcon copied={copied} />
            {copied ? 'Copied Successfully!' : 'Copy Key'}
          </button>
        </div>

        {/* Checkbox - مربع الإقرار بالمسؤولية */}
        <div className="dark-check-wrap">
          <button
            className={`dark-checkbox ${acknowledged ? 'checked' : ''}`}
            onClick={() => setAcknowledged(!acknowledged)}
            type="button"
          >
            {acknowledged && (
              <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
                <path d="M1 5l4 4L11 1" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
          <span className="dark-check-text">
            I acknowledge that I am responsible for saving this key and my data cannot be recovered without it
          </span>
        </div>

        {/* CTA Button - زر الانتقال للوحة التحكم */}
        <button
          onClick={() => acknowledged && navigate('/dashboard')}
          className="dark-btn-primary"
          disabled={!acknowledged}
          style={{ marginTop: 8 }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M3 9h12M10 4l6 5-6 5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Understood, Go to Dashboard
        </button>

        {/* Info Note - ملاحظة معلومات الإيميل */}
        <div className="dark-info-note">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
            <rect x="1" y="3" width="12" height="9" rx="2" stroke="#6b7280" strokeWidth="1.2"/>
            <path d="M1 5l6 4 6-4" stroke="#6b7280" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          A copy was sent to: <span style={{ color: '#dc2626' }}>{user?.email}</span>
        </div>

      </div>
    </div>
  );
};

// أيقونة المفتاح (Key Icon)
const KeyIcon = () => (
  <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
    <circle cx="13" cy="14" r="9" stroke="#dc2626" strokeWidth="2.5"/>
    <circle cx="13" cy="14" r="4" fill="#dc2626"/>
    <line x1="20" y1="21" x2="34" y2="35" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round"/>
    <line x1="29" y1="30" x2="29" y2="35" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round"/>
    <line x1="26" y1="27" x2="31" y2="27" stroke="#dc2626" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

// أيقونة النسخ (Copy Icon)
const CopyIcon = ({ copied }) => copied ? (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M3 8l4 4 6-7" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
) : (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="5" y="5" width="9" height="10" rx="2" stroke="#dc2626" strokeWidth="1.4"/>
    <path d="M5 5V3a2 2 0 00-2 2v8a2 2 0 002 2h7" stroke="#dc2626" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);

// أيقونة التحذير (Warning Icon)
const WarningIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
    <path d="M9 1L17 16H1L9 1z" stroke="#fca5a5" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M9 7v4M9 13v1" stroke="#fca5a5" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export default FirstKeyDisplay;