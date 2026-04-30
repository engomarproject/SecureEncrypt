import React, { useState, useEffect, useRef } from 'react';
import './OTPModal.css';

/**
 * مكون نافذة OTP المنبثقة (OTP Modal Component)
 * 
 * الوظيفة:
 * - عرض نافذة منبثقة لإدخال رمز التحقق المؤقت (OTP)
 * - عد تنازلي لوقت انتهاء صلاحية الرمز (5 دقائق)
 * - إمكانية إعادة إرسال الرمز عبر الإيميل
 * - التحقق من صحة الرمز قبل السماح بفك التشفير
 * 
 * @param {Function} onClose - دالة إغلاق النافذة
 * @param {Function} onVerify - دالة التحقق من الرمز
 * @param {Function} onResend - دالة إعادة إرسال الرمز
 * @param {string} userEmail - بريد المستخدم لعرضه في النافذة
 */
const OTPModal = ({ onClose, onVerify, onResend, userEmail }) => {
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [timeLeft, setTimeLeft] = useState(300); // 5 دقائق بالثواني
  const [canResend, setCanResend] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(60); // 60 ثانية بين كل إعادة إرسال
  
  const inputRefs = useRef([]);

  // العد التنازلي لانتهاء صلاحية OTP
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // العد التنازلي لإعادة الإرسال
  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setInterval(() => {
        setResendCountdown((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [resendCountdown]);

  // تنسيق الوقت المتبقي (دقائق:ثواني)
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // التعامل مع تغيير كل خانة من OTP
  const handleInputChange = (element, index) => {
    const value = element.value;
    
    // السماح فقط بالأرقام
    if (value && !/^\d+$/.test(value)) {
      return;
    }

    const newOtp = [...otpCode];
    newOtp[index] = value.substring(value.length - 1);
    setOtpCode(newOtp);
    setError('');

    // الانتقال التلقائي للخانة التالية
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // التعامل مع الضغط على Backspace
  const handleKeyDown = (e, index) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    
    // التعامل مع الضغط على Enter للتحقق
    if (e.key === 'Enter') {
      handleVerify();
    }
  };

  // التعامل مع اللصق (Paste)
  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6);
    
    if (/^\d+$/.test(pastedData)) {
      const newOtp = [...otpCode];
      pastedData.split('').forEach((char, index) => {
        if (index < 6) {
          newOtp[index] = char;
        }
      });
      setOtpCode(newOtp);
      
      // التركيز على آخر خانة ممتلئة
      const nextEmptyIndex = Math.min(pastedData.length, 5);
      inputRefs.current[nextEmptyIndex]?.focus();
    }
  };

  // التحقق من الرمز
  const handleVerify = async () => {
    const otp = otpCode.join('');
    
    if (otp.length !== 6) {
      setError('Please enter a 6-digit OTP code');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await onVerify(otp);
      setSuccess('Verified successfully!');
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      setError(err.message || 'Invalid OTP code, please try again');
      setOtpCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  // إعادة إرسال الرمز
  const handleResend = async () => {
    if (!canResend) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await onResend();
      setSuccess('New OTP code sent to your email');
      setResendCountdown(60);
      setCanResend(false);
      setOtpCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (err) {
      setError(err.message || 'Failed to resend code, please try again later');
    } finally {
      setLoading(false);
    }
  };

  // إغلاق النافذة
  const handleClose = () => {
    setOtpCode(['', '', '', '', '', '']);
    setError('');
    setSuccess('');
    onClose();
  };

  return (
    <div className="otp-modal-overlay" onClick={handleClose}>
      <div className="otp-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* رأس النافذة */}
        <div className="otp-modal-header">
          <div className="otp-icon">🔐</div>
          <h2>Identity Verification</h2>
          <button className="otp-close-btn" onClick={handleClose}>×</button>
        </div>

        {/* محتوى النافذة */}
        <div className="otp-modal-body">
          {/* رسالة توضيحية */}
          <div className="otp-description">
            <p>We have sent a 6-digit verification code to your email:</p>
            <p className="otp-email">{userEmail || 'user@example.com'}</p>
            <p className="otp-hint">Please enter the code to proceed with decryption</p>
          </div>

          {/* عرض رسائل الخطأ والنجاح */}
          {error && (
            <div className="otp-alert otp-alert-error">
              <span className="otp-alert-icon">⚠️</span>
              {error}
            </div>
          )}
          
          {success && (
            <div className="otp-alert otp-alert-success">
              <span className="otp-alert-icon">✅</span>
              {success}
            </div>
          )}

          {/* حقول إدخال OTP */}
          <div className="otp-inputs-container">
            {otpCode.map((digit, index) => (
              <input
                key={index}
                ref={(el) => (inputRefs.current[index] = el)}
                type="text"
                maxLength="1"
                className={`otp-input ${digit ? 'filled' : ''}`}
                value={digit}
                onChange={(e) => handleInputChange(e.target, index)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                onPaste={handlePaste}
                disabled={loading || timeLeft === 0}
                autoComplete="off"
              />
            ))}
          </div>

          {/* العداد التنازلي */}
          <div className={`otp-timer ${timeLeft < 60 ? 'otp-timer-warning' : ''}`}>
            <span className="timer-icon">⏱️</span>
            <span>Code expires in: {formatTime(timeLeft)}</span>
          </div>

          {/* زر التحقق */}
          <button
            className="otp-verify-btn"
            onClick={handleVerify}
            disabled={loading || otpCode.join('').length !== 6 || timeLeft === 0}
          >
            {loading ? (
              <>
                <span className="otp-spinner"></span>
                Verifying...
              </>
            ) : (
              '✅ Verify Code'
            )}
          </button>

          {/* إعادة الإرسال */}
          <div className="otp-resend-section">
            <p>Didn't receive the code?</p>
            {canResend ? (
              <button
                className="otp-resend-btn"
                onClick={handleResend}
                disabled={loading}
              >
                {loading ? 'Sending...' : '📧 Resend Code'}
              </button>
            ) : (
              <span className="otp-resend-wait">
                Wait {resendCountdown} seconds before resending
              </span>
            )}
          </div>

          {/* ملاحظات أمنية */}
          <div className="otp-security-note">
            <p>🛡️ This code is valid for 5 minutes only and should not be shared with anyone</p>
          </div>
        </div>

        {/* تذييل النافذة */}
        <div className="otp-modal-footer">
          <button className="otp-cancel-btn" onClick={handleClose}>
            Cancel Operation
          </button>
        </div>
      </div>
    </div>
  );
};

export default OTPModal;