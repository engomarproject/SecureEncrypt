import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import OTPModal from '../components/OTPModal';
import '../App.css';

const Dashboard = () => {
  const navigate         = useNavigate();
  const { user, logout } = useAuth();
  const encFileRef       = useRef(null);
  const decFileRef       = useRef(null);

  const [activeTab,      setActiveTab]      = useState('encrypt');
  const [inputData,      setInputData]      = useState('');
  const [inputKey,       setInputKey]       = useState('');
  const [result,         setResult]         = useState('');
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState('');
  const [success,        setSuccess]        = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showOTPModal,   setShowOTPModal]   = useState(false);
  const [pendingOp,      setPendingOp]      = useState(null);
  const [history,        setHistory]        = useState([]);
  const [savedFiles,     setSavedFiles]     = useState([]);
  const [encFile,        setEncFile]        = useState(null);
  const [decFile,        setDecFile]        = useState(null);
  const [decKey,         setDecKey]         = useState('');

  useEffect(() => {
    fetchHistory();
    fetchSavedFiles();
  }, []);

  const fetchHistory = async () => {
    try {
      const r = await api.get('/history');
      if (r.data?.success) setHistory(r.data.data?.history || []);
    } catch { setHistory([]); }
  };

  const fetchSavedFiles = async () => {
    try {
      const r = await api.get('/files');
      if (r.data?.success) setSavedFiles(r.data.data?.files || []);
    } catch { setSavedFiles([]); }
  };

  // ── تشفير نص ──────────────────────────────────────────────────────
  const handleEncrypt = async () => {
    if (!inputData.trim()) { setError('Please enter text to encrypt'); return; }
    setLoading(true); setError(''); setSuccess(''); setResult('');
    try {
      const r = await api.post('/encrypt', { data: inputData });
      if (r.data?.success) {
        setResult(r.data.data?.encrypted);
        setSuccess('Encryption successful!');
        navigator.clipboard.writeText(r.data.data?.encrypted).catch(() => {});
        fetchHistory();
      }
    } catch (err) { setError(err.message || 'Encryption failed'); }
    finally { setLoading(false); }
  };

  // ── تشفير ملف ────────────────────────────────────────────────────
  const handleEncFileSelect = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 50 * 1024 * 1024) { setError('Maximum file size is 50MB'); return; }
    setEncFile(f); setError('');
  };

  const handleEncryptFile = async () => {
    if (!encFile) { setError('Please select a file'); return; }
    setLoading(true); setError(''); setSuccess(''); setUploadProgress(0);
    try {
      const fd = new FormData();
      fd.append('file', encFile);
      const r = await api.post('/upload-encrypt', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        responseType: 'blob',
        onUploadProgress: (e) => { if (e.total) setUploadProgress(Math.round((e.loaded * 100) / e.total)); },
        timeout: 120000,
      });
      const encFilename = encFile.name + '.enc';
      const url = window.URL.createObjectURL(new Blob([r.data], { type: 'application/octet-stream' }));
      const a = document.createElement('a');
      a.href = url; a.setAttribute('download', encFilename);
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
      setSuccess('✅ File encrypted! Downloading "' + encFilename + '" to your device.');
      setEncFile(null);
      if (encFileRef.current) encFileRef.current.value = '';
      fetchSavedFiles(); fetchHistory();
    } catch (err) { setError(err.message || 'File encryption failed'); }
    finally { setLoading(false); setUploadProgress(0); }
  };

  // ── فك تشفير ملف ─────────────────────────────────────────────────
  const handleDecFileSelect = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (!f.name.endsWith('.enc')) {
      setError('Please upload an encrypted file with .enc extension'); return;
    }
    setDecFile(f); setError('');
  };

  const handleDecryptFileRequest = async () => {
    if (!decFile) { setError('Please select a .enc file'); return; }
    if (!decKey.trim()) { setError('Please enter the encryption key'); return; }
    setLoading(true); setError(''); setSuccess('');
    try {
      await api.post('/request-otp');
      setPendingOp({ type: 'decrypt-file', file: decFile, key: decKey });
      setShowOTPModal(true);
    } catch (err) { setError(err.message || 'Failed to send OTP code'); }
    finally { setLoading(false); }
  };

  const completeDecryptFile = async (otpCode) => {
    setLoading(true); setError(''); setSuccess('');
    try {
      await api.post('/verify-otp', { otp: otpCode });
      const fd = new FormData();
      fd.append('file', pendingOp.file);
      fd.append('key', pendingOp.key);
      const r = await api.post('/decrypt-file', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        responseType: 'blob', timeout: 120000,
      });
      const originalName = pendingOp.file.name.endsWith('.enc')
        ? pendingOp.file.name.slice(0, -4) : pendingOp.file.name;
      const url = window.URL.createObjectURL(new Blob([r.data]));
      const a = document.createElement('a');
      a.href = url; a.setAttribute('download', originalName);
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
      setSuccess('✅ Decryption successful! Downloading "' + originalName + '"');
      setDecFile(null); setDecKey('');
      if (decFileRef.current) decFileRef.current.value = '';
      setShowOTPModal(false); setPendingOp(null);
      fetchHistory();
    } catch (err) {
      setError(err.message || 'Decryption failed — please verify the file and key');
      setShowOTPModal(false); setPendingOp(null);
    } finally { setLoading(false); }
  };

  // ── فك تشفير نص ───────────────────────────────────────────────────
  const handleDecryptTextRequest = async () => {
    if (!inputData.trim()) { setError('Please enter encrypted text'); return; }
    if (!inputKey.trim())  { setError('Please enter the encryption key'); return; }
    setLoading(true); setError(''); setSuccess('');
    try {
      await api.post('/request-otp');
      setPendingOp({ type: 'decrypt-text', token: inputData, key: inputKey });
      setShowOTPModal(true);
    } catch (err) { setError(err.message || 'Failed to send OTP code'); }
    finally { setLoading(false); }
  };

  const completeDecryptText = async (otpCode) => {
    setLoading(true); setError(''); setSuccess(''); setResult('');
    try {
      await api.post('/verify-otp', { otp: otpCode });
      const r = await api.post('/decrypt', { token: pendingOp.token, key: pendingOp.key });
      if (r.data?.success) {
        setResult(r.data.data?.decrypted);
        setSuccess('Decryption successful!');
        fetchHistory();
      }
      setShowOTPModal(false); setPendingOp(null);
    } catch (err) {
      setError(err.message || 'Decryption failed');
      setShowOTPModal(false); setPendingOp(null);
    } finally { setLoading(false); }
  };

  // ── تحميل من قائمة الملفات ────────────────────────────────────────
  const handleDownloadEncrypted = async (fileId, filename) => {
    try {
      const r = await api.get('/download-encrypted/' + fileId, { responseType: 'blob', timeout: 120000 });
      const url = window.URL.createObjectURL(new Blob([r.data]));
      const a = document.createElement('a');
      a.href = url; a.setAttribute('download', filename + '.enc');
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) { setError(err.message || 'Download failed'); }
  };

  const handleDownloadOriginal = async (fileId, filename) => {
    setLoading(true); setError(''); setSuccess('');
    try {
      await api.post('/request-otp');
      setPendingOp({ type: 'download-original', fileId, filename });
      setShowOTPModal(true);
    } catch (err) { setError(err.message || 'Failed to send OTP code'); }
    finally { setLoading(false); }
  };

  const completeDownloadOriginal = async (otpCode) => {
    try {
      await api.post('/verify-otp', { otp: otpCode });
      const r = await api.get('/download-decrypt/' + pendingOp.fileId, { responseType: 'blob', timeout: 120000 });
      const url = window.URL.createObjectURL(new Blob([r.data]));
      const a = document.createElement('a');
      a.href = url; a.setAttribute('download', pendingOp.filename);
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
      setSuccess('✅ Original file downloaded successfully!');
      setShowOTPModal(false); setPendingOp(null);
    } catch (err) {
      setError(err.message || 'Download failed');
      setShowOTPModal(false); setPendingOp(null);
    } finally { setLoading(false); }
  };

  const handleDeleteFile = async (fileId, filename) => {
    if (!window.confirm('Delete "' + filename + '"?')) return;
    try {
      await api.delete('/delete-file/' + fileId);
      setSuccess('File deleted successfully');
      fetchSavedFiles();
    } catch (err) { setError(err.message || 'Deletion failed'); }
  };

  const handleResendOTP = async () => {
    try { await api.post('/request-otp'); }
    catch (err) { setError(err.message || 'Failed to resend OTP code'); }
  };

  const handleSendKey = async () => {
    setLoading(true); setError(''); setSuccess('');
    try {
      const r = await api.post('/send-key');
      if (r.data?.success) setSuccess(r.data.data?.message || 'Key sent to your email');
    } catch (err) { setError(err.message || 'Failed to send key'); }
    finally { setLoading(false); }
  };

  const handleLogout = async () => {
    try { await signOut(auth); logout(); navigate('/login'); }
    catch { setError('Failed to sign out'); }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setSuccess('Copied to clipboard');
    setTimeout(() => setSuccess(''), 2000);
  };

  const clearFields = () => {
    setInputData(''); setInputKey(''); setResult(''); setError(''); setSuccess('');
  };

  const formatDate = (ts) => {
    if (!ts) return '—';
    const d = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
    return d.toLocaleString('en-US');
  };

  const formatSize = (bytes) => {
    if (!bytes) return '—';
    if (bytes < 1024)        return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleOTPVerify = (otpCode) => {
    if (!pendingOp) return;
    if (pendingOp.type === 'decrypt-file')      return completeDecryptFile(otpCode);
    if (pendingOp.type === 'decrypt-text')      return completeDecryptText(otpCode);
    if (pendingOp.type === 'download-original') return completeDownloadOriginal(otpCode);
  };

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="header-content">
          <div className="logo-section">
            <span className="logo-icon">🔒</span>
            <h1>Secure Encryption Tool</h1>
          </div>
          <div className="user-section">
            <div className="user-info">
              <span className="user-email">{user?.email}</span>
              {user?.emailVerified
                ? <span className="user-status verified">✓ Verified</span>
                : <span className="user-status unverified">⚠ Unverified</span>
              }
            </div>
            <button onClick={() => navigate('/profile')} className="btn btn-secondary btn-sm">👤 My Account</button>
            <button onClick={handleLogout} className="btn-logout">Logout</button>
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        {error   && <div className="alert alert-error"><span className="alert-icon">⚠️</span>{error}<button onClick={() => setError('')} className="alert-close">×</button></div>}
        {success && <div className="alert alert-success"><span className="alert-icon">✅</span>{success}<button onClick={() => setSuccess('')} className="alert-close">×</button></div>}

        <div className="tabs-container">
          {[
            ['encrypt',      '🔐 Encrypt Text'],
            ['decrypt',      '🔓 Decrypt Text'],
            ['file-encrypt', '📁 Encrypt File'],
            ['file-decrypt', '📂 Decrypt File'],
            ['saved',        '☁️ My Saved Files'],
            ['history',      '📜 History'],
          ].map(([id, label]) => (
            <button key={id} className={`tab ${activeTab === id ? 'active' : ''}`} onClick={() => setActiveTab(id)}>
              {label}
            </button>
          ))}
        </div>

        <div className="tab-content">

          {/* ══ Encrypt Text ══ */}
          {activeTab === 'encrypt' && (
            <div className="tab-panel">
              <div className="card">
                <div className="card-header"><h2>Encrypt Text</h2><p>Enter text and it will be encrypted using your account key</p></div>
                <div className="form-group">
                  <label>Text to Encrypt</label>
                  <textarea className="form-textarea" rows="6" placeholder="Enter text here..."
                    value={inputData} onChange={e => setInputData(e.target.value)} disabled={loading} />
                </div>
                <div className="button-group">
                  <button onClick={handleEncrypt} className="btn btn-primary" disabled={loading || !inputData.trim()}>
                    {loading ? <><span className="spinner"></span> Processing...</> : '🔐 Encrypt'}
                  </button>
                  <button onClick={clearFields} className="btn btn-secondary" disabled={loading}>Clear</button>
                </div>
                {result && (
                  <div className="result-section">
                    <label>Encrypted Text:</label>
                    <div className="result-box">
                      <code>{result}</code>
                      <button onClick={() => copyToClipboard(result)} className="btn-copy">📋</button>
                    </div>
                  </div>
                )}
              </div>
              <div className="card info-card">
                <h3>📌 Information</h3>
                <ul style={{ paddingRight: 20, marginTop: 8, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 2 }}>
                  <li>Uses your account's encryption key automatically</li>
                  <li>Save the encrypted text in a secure location</li>
                </ul>
                <button onClick={handleSendKey} className="btn btn-warning btn-sm" disabled={loading} style={{ marginTop: 12 }}>
                  📧 Send Key to My Email
                </button>
              </div>
            </div>
          )}

          {/* ══ Decrypt Text ══ */}
          {activeTab === 'decrypt' && (
            <div className="tab-panel">
              <div className="card">
                <div className="card-header"><h2>🔓 Decrypt Text</h2><p>Enter the encrypted text and your encryption key to reveal the original content</p></div>
                <div className="form-group">
                  <label>Encrypted Text</label>
                  <textarea className="form-textarea" rows="4" placeholder="Paste encrypted text here..."
                    value={inputData} onChange={e => setInputData(e.target.value)} disabled={loading} />
                </div>
                <div className="form-group">
                  <label>Encryption Key</label>
                  <input type="text" className="form-input" placeholder="Enter your encryption key (44 characters)..."
                    value={inputKey} onChange={e => setInputKey(e.target.value)} disabled={loading} />
                  <small className="form-hint">You can get your key from your email — click "Send Key to My Email" in the Encrypt tab</small>
                </div>
                <div className="button-group">
                  <button
                    onClick={handleDecryptTextRequest}
                    className="btn btn-primary"
                    disabled={loading || !inputData.trim() || !inputKey.trim()}
                    style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)' }}
                  >
                    {loading ? <><span className="spinner"></span> Sending OTP...</> : '🔓 Decrypt'}
                  </button>
                  <button onClick={clearFields} className="btn btn-secondary" disabled={loading}>Clear</button>
                </div>
                {result && (
                  <div className="result-section">
                    <label>Original Text:</label>
                    <div className="result-box success">
                      <code>{result}</code>
                      <button onClick={() => copyToClipboard(result)} className="btn-copy">📋</button>
                    </div>
                  </div>
                )}
              </div>
              <div className="card security-card">
                <h3>🛡️ Security Measures</h3>
                <ul style={{ paddingRight: 20, marginTop: 8, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 2 }}>
                  <li>Requires OTP code sent to your email for verification</li>
                  <li>OTP code is valid for 5 minutes only</li>
                  <li>The key must match the original encryption key used</li>
                </ul>
              </div>
            </div>
          )}

          {/* ══ Encrypt File ══ */}
          {activeTab === 'file-encrypt' && (
            <div className="tab-panel">
              <div className="card">
                <div className="card-header">
                  <h2>🔐 Encrypt File</h2>
                  <p>Upload any file and get an encrypted version (<strong>.enc</strong>) on your device + a copy saved on Cloudinary</p>
                </div>
                <div className="form-group">
                  <label>Select File (up to 50MB)</label>
                  <input
                    type="file" ref={encFileRef} className="form-input"
                    onChange={handleEncFileSelect} disabled={loading}
                    accept=".txt,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.png,.jpg,.jpeg,.gif,.webp,.bmp,.mp3,.mp4"
                  />
                  {encFile && (
                    <div className="file-info">
                      <span>{encFile.type.startsWith('image') ? '🖼️' : '📄'} {encFile.name}</span>
                      <span>({formatSize(encFile.size)})</span>
                    </div>
                  )}
                </div>
                {uploadProgress > 0 && uploadProgress < 100 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Uploading... {uploadProgress}%</div>
                    <div className="progress-bar"><div className="progress-fill" style={{ width: uploadProgress + '%' }}></div></div>
                  </div>
                )}
                <div className="button-group">
                  <button onClick={handleEncryptFile} className="btn btn-primary" disabled={loading || !encFile}>
                    {loading ? <><span className="spinner"></span> Encrypting...</> : '🔐 Encrypt & Download Encrypted File'}
                  </button>
                  <button onClick={() => { setEncFile(null); if (encFileRef.current) encFileRef.current.value = ''; }} className="btn btn-secondary" disabled={loading}>Cancel</button>
                </div>
              </div>
              <div className="card info-card">
                <h3>ℹ️ What happens?</h3>
                <ul style={{ paddingRight: 20, marginTop: 8, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 2.2 }}>
                  <li>📤 Upload file → encrypted on server with your personal key</li>
                  <li>💾 Encrypted copy saved on Cloudinary (for future reference)</li>
                  <li>⬇️ Download <strong>filename.ext.enc</strong> file to your device</li>
                  <li>🔓 To decrypt: use the "Decrypt File" tab</li>
                </ul>
              </div>
            </div>
          )}

          {/* ══ Decrypt File ══ */}
          {activeTab === 'file-decrypt' && (
            <div className="tab-panel">
              <div className="card">
                <div className="card-header">
                  <h2>📂 Decrypt File</h2>
                  <p>Upload the encrypted file (<strong>.enc</strong>) + enter the encryption key</p>
                </div>
                <div className="form-group">
                  <label>Encrypted File (.enc)</label>
                  <input type="file" ref={decFileRef} className="form-input"
                    onChange={handleDecFileSelect} disabled={loading} accept=".enc" />
                  {decFile && (
                    <div className="file-info">
                      <span>🔒 {decFile.name}</span>
                      <span>({formatSize(decFile.size)})</span>
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label>Encryption Key</label>
                  <input type="text" className="form-input"
                    placeholder="Enter encryption key (44 characters)..."
                    value={decKey} onChange={e => setDecKey(e.target.value)} disabled={loading} />
                  <small className="form-hint">You can get your key from your email</small>
                </div>
                <div className="button-group">
                  <button
                    onClick={handleDecryptFileRequest}
                    className="btn btn-primary"
                    disabled={loading || !decFile || !decKey.trim()}
                    style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)' }}
                  >
                    {loading ? <><span className="spinner"></span> Sending OTP...</> : '🔓 Decrypt File'}
                  </button>
                  <button onClick={() => { setDecFile(null); setDecKey(''); if (decFileRef.current) decFileRef.current.value = ''; }} className="btn btn-secondary" disabled={loading}>Clear</button>
                </div>
              </div>
              <div className="card security-card">
                <h3>🛡️ Security Measures</h3>
                <ul style={{ paddingRight: 20, marginTop: 8, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 2 }}>
                  <li>Requires OTP code sent to your email</li>
                  <li>Code is valid for 5 minutes only</li>
                  <li>Key must match the original encryption key</li>
                </ul>
              </div>
            </div>
          )}

          {/* ══ Saved Files ══ */}
          {activeTab === 'saved' && (
            <div className="tab-panel">
              <div className="card">
                <div className="card-header">
                  <h2>☁️ My Saved Files on Cloudinary</h2>
                  <p>Download encrypted version (.enc) or original file directly</p>
                </div>
                {savedFiles.length === 0 ? (
                  <div className="empty-state">
                    <span className="empty-icon">☁️</span>
                    <p>No saved files yet</p>
                    <small>Encrypt a file from the "Encrypt File" tab and it will appear here</small>
                  </div>
                ) : (
                  <div className="files-list">
                    {savedFiles.map((f, i) => (
                      <div key={f.id || i} className="file-item">
                        <div style={{ flex: 1 }}>
                          <div className="file-name">
                            {f.is_image ? '🖼️' : '📄'} {f.filename}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                            {formatSize(f.file_size)} · {formatDate(f.created_at)} · ☁️ Cloudinary
                          </div>
                        </div>
                        <button onClick={() => handleDownloadEncrypted(f.id, f.filename)} className="btn btn-sm btn-secondary" title="Download encrypted file (.enc)">⬇️ .enc</button>
                        <button onClick={() => handleDownloadOriginal(f.id, f.filename)} className="btn btn-sm btn-primary" disabled={loading} title="Decrypt and download original file">🔓 Original</button>
                        <button onClick={() => handleDeleteFile(f.id, f.filename)} className="btn btn-sm btn-danger" title="Delete">🗑️</button>
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={fetchSavedFiles} className="btn btn-secondary btn-sm" style={{ marginTop: 12 }}>🔄 Refresh</button>
              </div>
            </div>
          )}

          {/* ══ History ══ */}
          {activeTab === 'history' && (
            <div className="tab-panel">
              <div className="card">
                <div className="card-header"><h2>Operations History</h2></div>
                {history.length === 0 ? (
                  <div className="empty-state"><span className="empty-icon">📭</span><p>No previous operations</p></div>
                ) : (
                  <div className="history-table">
                    <table>
                      <thead><tr><th>#</th><th>Operation Type</th><th>Date</th><th>Status</th></tr></thead>
                      <tbody>
                        {history.map((item, i) => (
                          <tr key={item.id || i}>
                            <td>{i + 1}</td>
                            <td>
                              <span className={`badge badge-${item.operation_type?.includes('encrypt') ? 'encrypt' : 'decrypt'}`}>
                                {item.operation_type === 'encrypt'      ? '🔐 Encrypt Text' :
                                 item.operation_type === 'file_encrypt' ? '📁 Encrypt File' :
                                 item.operation_type === 'file_decrypt' ? '📂 Decrypt File' :
                                 item.operation_type === 'file_delete'  ? '🗑️ Delete File' :
                                 '🔓 Decrypt Text'}
                              </span>
                            </td>
                            <td style={{ fontSize: 12 }}>{item.timestamp ? formatDate(item.timestamp) : '—'}</td>
                            <td><span className="status-success">✓ Success</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <button onClick={fetchHistory} className="btn btn-secondary btn-sm" style={{ marginTop: 12 }}>🔄 Refresh</button>
              </div>
            </div>
          )}

        </div>
      </main>

      <footer className="dashboard-footer">
        <p>© {new Date().getFullYear()} SecureEncrypt - All rights reserved</p>
      </footer>

      {showOTPModal && (
        <OTPModal
          onClose={() => { setShowOTPModal(false); setPendingOp(null); setLoading(false); }}
          onVerify={handleOTPVerify}
          onResend={handleResendOTP}
          userEmail={user?.email}
        />
      )}
    </div>
  );
};

export default Dashboard;