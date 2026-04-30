import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import OTPModal from '../components/OTPModal';
import '../App.css';

const AdminDashboard = () => {
  const navigate         = useNavigate();
  const { user, logout } = useAuth();
  const fileInputRef     = useRef(null);
  const encFileRef       = useRef(null);
  const decFileRef       = useRef(null);

  const [activeTab,      setActiveTab]      = useState('users');
  const [users,          setUsers]          = useState([]);
  const [selectedUser,   setSelectedUser]   = useState(null);
  const [editRequests,   setEditRequests]   = useState([]);
  const [inputData,      setInputData]      = useState('');
  const [inputKey,       setInputKey]       = useState('');
  const [result,         setResult]         = useState('');
  const [selectedFile,   setSelectedFile]   = useState(null);
  const [fileResult,     setFileResult]     = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [history,        setHistory]        = useState([]);
  const [encFiles,       setEncFiles]       = useState([]);
  const [showOTPModal,   setShowOTPModal]   = useState(false);
  const [pendingOp,      setPendingOp]      = useState(null);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState('');
  const [success,        setSuccess]        = useState('');

  // File Encrypt tab state
  const [encFile,        setEncFile]        = useState(null);
  const [encProgress,    setEncProgress]    = useState(0);

  // File Decrypt tab state
  const [decFile,        setDecFile]        = useState(null);
  const [decKey,         setDecKey]         = useState('');

  useEffect(() => {
    fetchAllUsers();
    fetchEditRequests();
    fetchHistory();
    fetchEncFiles();
  }, []);

  // ── Admin functions ──────────────────────────────────────────────
  const fetchAllUsers = async () => {
    try {
      const res = await api.get('/admin/users');
      setUsers(res.data.data?.users || []);
    } catch (err) { setError(err.message || 'Failed to fetch users'); }
  };

  const fetchEditRequests = async () => {
    try {
      const res = await api.get('/admin/edit-requests');
      setEditRequests(res.data.data?.requests || []);
    } catch { setEditRequests([]); }
  };

  const handleViewUserDetails = async (uid) => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/user/${uid}`);
      setSelectedUser(res.data.data?.user);
    } catch (err) { setError(err.message || 'Failed to fetch details'); }
    finally { setLoading(false); }
  };

  const handleEditRequest = async (requestId, action) => {
    setLoading(true); setError(''); setSuccess('');
    try {
      const res = await api.post(`/admin/edit-requests/${requestId}`, { action });
      if (res.data.success) {
        setSuccess(action === 'approve' ? '✅ Approved and changes applied' : '❌ Request rejected');
        fetchEditRequests(); fetchAllUsers();
      }
    } catch (err) { setError(err.message || 'Failed to process request'); }
    finally { setLoading(false); }
  };

  // ── Encryption functions ─────────────────────────────────────────
  const fetchHistory  = async () => { try { const r = await api.get('/history'); setHistory(r.data.data?.history || []); } catch { setHistory([]); } };
  const fetchEncFiles = async () => { try { const r = await api.get('/files');   setEncFiles(r.data.data?.files   || []); } catch { setEncFiles([]); } };

  const handleEncrypt = async () => {
    if (!inputData.trim()) { setError('Please enter text to encrypt'); return; }
    setLoading(true); setError(''); setSuccess(''); setResult('');
    try {
      const res = await api.post('/encrypt', { data: inputData });
      if (res.data?.success) {
        setResult(res.data.data?.encrypted);
        setSuccess('Encryption successful!');
        navigator.clipboard.writeText(res.data.data?.encrypted).catch(() => {});
        fetchHistory();
      }
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  // ── تشفير ملف (Encrypt File tab) ─────────────────────────────────
  const handleEncFileSelect = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 50 * 1024 * 1024) { setError('Maximum file size is 50MB'); return; }
    setEncFile(f); setError('');
  };

  const handleEncryptFile = async () => {
    if (!encFile) { setError('Please select a file'); return; }
    setLoading(true); setError(''); setSuccess(''); setEncProgress(0);
    try {
      const fd = new FormData();
      fd.append('file', encFile);
      const r = await api.post('/upload-encrypt', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        responseType: 'blob',
        onUploadProgress: (e) => { if (e.total) setEncProgress(Math.round((e.loaded * 100) / e.total)); },
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
      fetchEncFiles(); fetchHistory();
    } catch (err) { setError(err.message || 'File encryption failed'); }
    finally { setLoading(false); setEncProgress(0); }
  };

  // ── فك تشفير ملف (Decrypt File tab) ──────────────────────────────
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

  // ── Decrypt text ─────────────────────────────────────────────────
  const handleDecryptRequest = async () => {
    if (!inputData.trim()) { setError('Please enter encrypted text'); return; }
    if (!inputKey.trim())  { setError('Please enter encryption key'); return; }
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
      const res = await api.post('/decrypt', { token: pendingOp.token, key: pendingOp.key });
      if (res.data?.success) { setResult(res.data.data?.decrypted); setSuccess('Decryption successful!'); fetchHistory(); }
      setShowOTPModal(false); setPendingOp(null);
    } catch (err) {
      setError(err.message);
      setShowOTPModal(false); setPendingOp(null);
    } finally { setLoading(false); }
  };

  // ── Encrypt text file (old Files tab logic kept) ─────────────────
  const handleFileSelect = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 50 * 1024 * 1024) { setError('Maximum file size is 50MB'); return; }
    setSelectedFile(f); setError('');
  };

  const handleFileUpload = async () => {
    if (!selectedFile) { setError('Please select a file first'); return; }
    setLoading(true); setError(''); setSuccess(''); setUploadProgress(0);
    try {
      const fd = new FormData();
      fd.append('file', selectedFile);
      const res = await api.post('/upload-encrypt', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        responseType: 'blob',
        onUploadProgress: (e) => setUploadProgress(Math.round((e.loaded * 100) / e.total)),
      });
      const encFilename = selectedFile.name + '.enc';
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url; a.setAttribute('download', encFilename);
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
      setSuccess(`✅ File encrypted and downloaded as "${encFilename}"`);
      setFileResult({ filename: encFilename });
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => fetchEncFiles(), 1500);
    } catch (err) {
      if (err.response?.data instanceof Blob) {
        const text = await err.response.data.text();
        try { const json = JSON.parse(text); setError(json.error || 'Upload failed'); }
        catch { setError('Upload failed. Please try again.'); }
      } else { setError(err.message || 'Upload failed'); }
    }
    finally { setLoading(false); }
  };

  // ── Download from saved files list ───────────────────────────────
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

  const handleFileDownload = async (fileId, filename) => {
    setLoading(true); setError(''); setSuccess('');
    try {
      await api.post('/request-otp');
      setPendingOp({ type: 'download-original', fileId, filename });
      setShowOTPModal(true);
    } catch (err) { setError(err.message || 'Failed to send OTP code'); }
    finally { setLoading(false); }
  };

  const completeDownload = async (otpCode) => {
    try {
      await api.post('/verify-otp', { otp: otpCode });
      const res = await api.get(`/download-decrypt/${pendingOp.fileId}`, { responseType: 'blob', timeout: 120000 });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url; a.setAttribute('download', pendingOp.filename);
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
      setSuccess('✅ Original file downloaded successfully!');
      setShowOTPModal(false); setPendingOp(null);
    } catch (err) {
      setError(err.message);
      setShowOTPModal(false); setPendingOp(null);
    } finally { setLoading(false); }
  };

  const handleDeleteFile = async (fileId, filename) => {
    if (!window.confirm('Delete "' + filename + '"?')) return;
    try {
      await api.delete('/delete-file/' + fileId);
      setSuccess('File deleted successfully');
      fetchEncFiles();
    } catch (err) { setError(err.message || 'Deletion failed'); }
  };

  const handleRequestOTP = async () => { try { await api.post('/request-otp'); } catch {} };

  const handleSendKey = async () => {
    setLoading(true); setError(''); setSuccess('');
    try { const r = await api.post('/send-key'); if (r.data?.success) setSuccess('Key sent to your email'); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setSuccess('Copied to clipboard'); setTimeout(() => setSuccess(''), 2000);
  };

  const clearFields = () => {
    setInputData(''); setInputKey(''); setResult('');
    setError(''); setSuccess('');
    setSelectedFile(null); setFileResult(null); setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleLogout = async () => {
    try { await signOut(auth); logout(); navigate('/login'); }
    catch { setError('Failed to sign out'); }
  };

  const formatDate = (ts) => {
    if (!ts) return 'Not available';
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
    if (pendingOp.type === 'download-original') return completeDownload(otpCode);
    if (pendingOp.type === 'download')          return completeDownload(otpCode);
  };

  const pendingCount = editRequests.filter(r => r.status === 'pending').length;

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="header-content">
          <div className="logo-section">
            <span className="logo-icon">🛡️</span>
            <h1>Admin Dashboard</h1>
          </div>
          <div className="user-section">
            <span className="user-email">{user?.email}</span>
            <span className="badge badge-warning" style={{ fontSize: 11 }}>🛡️ Admin</span>
            <button onClick={handleLogout} className="btn-logout">🚪 Logout</button>
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        {error && (
          <div className="alert alert-error">
            <span className="alert-icon">⚠️</span>{error}
            <button onClick={() => setError('')} className="alert-close">×</button>
          </div>
        )}
        {success && (
          <div className="alert alert-success">
            <span className="alert-icon">✅</span>{success}
            <button onClick={() => setSuccess('')} className="alert-close">×</button>
          </div>
        )}

        {/* Stats cards */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            ['👥 Users',           users.length,        'var(--accent-primary)'],
            ['⏳ Pending Requests', pendingCount,        'var(--accent-warning)'],
            ['📝 Total Requests',  editRequests.length, 'var(--text-muted)'],
          ].map(([label, val, color]) => (
            <div key={label} className="card" style={{ flex: 1, minWidth: 120, padding: '12px 16px', marginBottom: 0 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 24, fontWeight: 900, color }}>{val}</div>
            </div>
          ))}
        </div>

        <div className="tabs-container">
          <button className={`tab ${activeTab === 'users'        ? 'active' : ''}`} onClick={() => setActiveTab('users')}>👥 Users ({users.length})</button>
          <button className={`tab ${activeTab === 'requests'     ? 'active' : ''}`} onClick={() => setActiveTab('requests')}>
            📝 Edit Requests
            {pendingCount > 0 && <span className="badge badge-warning" style={{ marginRight: 6, fontSize: 11 }}>{pendingCount}</span>}
          </button>
          <button className={`tab ${activeTab === 'encrypt'      ? 'active' : ''}`} onClick={() => setActiveTab('encrypt')}>🔐 Encrypt Text</button>
          <button className={`tab ${activeTab === 'decrypt'      ? 'active' : ''}`} onClick={() => setActiveTab('decrypt')}>🔓 Decrypt Text</button>
          <button className={`tab ${activeTab === 'file-encrypt' ? 'active' : ''}`} onClick={() => setActiveTab('file-encrypt')}>📁 Encrypt File</button>
          <button className={`tab ${activeTab === 'file-decrypt' ? 'active' : ''}`} onClick={() => setActiveTab('file-decrypt')}>📂 Decrypt File</button>
          <button className={`tab ${activeTab === 'saved'        ? 'active' : ''}`} onClick={() => setActiveTab('saved')}>☁️ Saved Files</button>
          <button className={`tab ${activeTab === 'history'      ? 'active' : ''}`} onClick={() => setActiveTab('history')}>📜 History</button>
          <button className={`tab ${activeTab === 'stats'        ? 'active' : ''}`} onClick={() => setActiveTab('stats')}>📊 Statistics</button>
        </div>

        <div className="tab-content">

          {/* ══ Users Tab ══ */}
          {activeTab === 'users' && (
            <div className="tab-panel">
              <div className="card">
                <div className="card-header">
                  <h2>All Registered Users</h2>
                  <p>View and manage all accounts in the system</p>
                </div>
                {loading ? (
                  <div className="loading-state"><span className="spinner"></span> Loading...</div>
                ) : users.length === 0 ? (
                  <div className="empty-state"><span className="empty-icon">👥</span><p>No users registered yet</p></div>
                ) : (
                  <div className="users-table">
                    <table>
                      <thead>
                        <tr><th>#</th><th>Email</th><th>Name</th><th>Created At</th><th>Key Requests</th><th>Status</th><th>Actions</th></tr>
                      </thead>
                      <tbody>
                        {users.map((u, i) => (
                          <tr key={u.uid}>
                            <td>{i + 1}</td>
                            <td style={{ fontWeight: 600 }}>{u.email}</td>
                            <td>{u.full_name || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                            <td style={{ fontSize: 12 }}>{formatDate(u.created_at)}</td>
                            <td><span className={`badge ${(u.key_sent_count||0) > 3 ? 'badge-warning' : 'badge-info'}`}>{u.key_sent_count||0} times</span></td>
                            <td><span className={`badge ${u.is_active ? 'badge-approved' : 'badge-rejected'}`}>{u.is_active ? 'Active' : 'Disabled'}</span></td>
                            <td><button onClick={() => handleViewUserDetails(u.uid)} className="btn btn-sm btn-primary">🔍 Details</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <button onClick={fetchAllUsers} className="btn btn-secondary btn-sm" style={{ marginTop: 12 }} disabled={loading}>🔄 Refresh</button>
              </div>

              {selectedUser && (
                <div className="modal-overlay" onClick={() => setSelectedUser(null)}>
                  <div className="modal-content" onClick={e => e.stopPropagation()}>
                    <div className="modal-header">
                      <h3>👤 Details: {selectedUser.email}</h3>
                      <button onClick={() => setSelectedUser(null)} className="btn-close-modal">×</button>
                    </div>
                    <div className="modal-body">
                      {[
                        ['UID',             selectedUser.uid,                                       true],
                        ['Name',            selectedUser.full_name    || '—',                       false],
                        ['Bio',             selectedUser.bio           || '—',                       false],
                        ['Created At',      formatDate(selectedUser.created_at),                    false],
                        ['Last Updated',    formatDate(selectedUser.updated_at),                    false],
                        ['Key Requests',    selectedUser.key_sent_count,                            false],
                        ['Last Key Request',formatDate(selectedUser.last_key_request),              false],
                        ['Status',          selectedUser.is_active ? '✅ Active' : '❌ Disabled',   false],
                      ].map(([label, val, isCode]) => (
                        <div className="detail-item" key={label}>
                          <strong>{label}:</strong>
                          {isCode ? <code>{val}</code> : <span>{val}</span>}
                        </div>
                      ))}
                    </div>
                    <div className="modal-footer">
                      <button onClick={() => setSelectedUser(null)} className="btn btn-secondary">Close</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ Edit Requests Tab ══ */}
          {activeTab === 'requests' && (
            <div className="tab-panel">
              <div className="card">
                <div className="card-header">
                  <h2>User Data Edit Requests</h2>
                  <p>Review modifications and approve or reject</p>
                </div>
                {editRequests.length === 0 ? (
                  <div className="empty-state">
                    <span className="empty-icon">📋</span>
                    <p>No edit requests yet</p>
                    <small>Requests will appear here when users request to modify their data</small>
                  </div>
                ) : (
                  <div className="users-table">
                    <table>
                      <thead><tr><th>#</th><th>User</th><th>Current Data</th><th>Requested Changes</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead>
                      <tbody>
                        {editRequests.map((req, i) => (
                          <tr key={req.id}>
                            <td>{i + 1}</td>
                            <td style={{ fontWeight: 600, fontSize: 13 }}>{req.email}</td>
                            <td>
                              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                {req.current_data?.full_name && <div>Name: {req.current_data.full_name}</div>}
                                {req.current_data?.bio       && <div>Bio: {req.current_data.bio}</div>}
                                {!req.current_data?.full_name && !req.current_data?.bio && <span>—</span>}
                              </div>
                            </td>
                            <td>
                              <div style={{ fontSize: 12 }}>
                                {req.requested_data?.full_name && <div>Name: <strong style={{ color: 'var(--accent-primary)' }}>{req.requested_data.full_name}</strong></div>}
                                {req.requested_data?.bio       && <div>Bio: <strong style={{ color: 'var(--accent-primary)' }}>{req.requested_data.bio}</strong></div>}
                              </div>
                            </td>
                            <td style={{ fontSize: 12 }}>{formatDate(req.created_at)}</td>
                            <td>
                              <span className={`badge badge-${req.status === 'pending' ? 'pending' : req.status === 'approved' ? 'approved' : 'rejected'}`}>
                                {req.status === 'pending' ? '⏳ Pending' : req.status === 'approved' ? '✅ Approved' : '❌ Rejected'}
                              </span>
                            </td>
                            <td>
                              {req.status === 'pending' ? (
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <button onClick={() => handleEditRequest(req.id, 'approve')} className="btn btn-sm btn-success" disabled={loading}>✅ Approve</button>
                                  <button onClick={() => handleEditRequest(req.id, 'reject')}  className="btn btn-sm btn-danger"   disabled={loading}>❌ Reject</button>
                                </div>
                              ) : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Processed</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <button onClick={fetchEditRequests} className="btn btn-secondary btn-sm" style={{ marginTop: 12 }} disabled={loading}>🔄 Refresh</button>
              </div>
            </div>
          )}

          {/* ══ Encrypt Text Tab ══ */}
          {activeTab === 'encrypt' && (
            <div className="tab-panel">
              <div className="card">
                <div className="card-header"><h2>Encrypt New Data</h2></div>
                <div className="form-group">
                  <label>Text to Encrypt</label>
                  <textarea className="form-textarea" rows="6" placeholder="Enter text here..." value={inputData} onChange={e => setInputData(e.target.value)} disabled={loading} />
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
                    <div className="result-box"><code>{result}</code><button onClick={() => copyToClipboard(result)} className="btn-copy">📋</button></div>
                  </div>
                )}
              </div>
              <div className="card info-card">
                <h3>📌 Information</h3>
                <ul style={{ paddingRight: 20, marginTop: 8, color: 'var(--text-secondary)', fontSize: 14, lineHeight: 2 }}>
                  <li>Your account's encryption key is used automatically</li>
                  <li>Keep the encrypted text in a safe place</li>
                </ul>
                <button onClick={handleSendKey} className="btn btn-warning btn-sm" disabled={loading} style={{ marginTop: 12 }}>📧 Send Key to My Email</button>
              </div>
            </div>
          )}

          {/* ══ Decrypt Text Tab ══ */}
          {activeTab === 'decrypt' && (
            <div className="tab-panel">
              <div className="card">
                <div className="card-header">
                  <h2>🔓 Decrypt Data</h2>
                  <p>Enter the encrypted text and your encryption key to reveal the original content</p>
                </div>
                <div className="form-group">
                  <label>Encrypted Text</label>
                  <textarea
                    className="form-textarea" rows="4"
                    placeholder="Paste encrypted text here..."
                    value={inputData} onChange={e => setInputData(e.target.value)} disabled={loading}
                  />
                </div>
                <div className="form-group">
                  <label>Encryption Key</label>
                  <input
                    type="text" className="form-input"
                    placeholder="Enter your encryption key (44 characters)..."
                    value={inputKey} onChange={e => setInputKey(e.target.value)} disabled={loading}
                  />
                  <small className="form-hint">Use "Send Key to My Email" in the Encrypt tab to retrieve your key</small>
                </div>
                <div className="button-group">
                  <button
                    onClick={handleDecryptRequest}
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
                  <li>Requires OTP verification sent to your email</li>
                  <li>OTP code is valid for 5 minutes only</li>
                  <li>Key must match the original encryption key used</li>
                </ul>
              </div>
            </div>
          )}

          {/* ══ Encrypt File Tab ══ */}
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
                {encProgress > 0 && encProgress < 100 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Uploading... {encProgress}%</div>
                    <div className="progress-bar"><div className="progress-fill" style={{ width: encProgress + '%' }}></div></div>
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

          {/* ══ Decrypt File Tab ══ */}
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

          {/* ══ Saved Files Tab ══ */}
          {activeTab === 'saved' && (
            <div className="tab-panel">
              <div className="card">
                <div className="card-header">
                  <h2>☁️ My Saved Files on Cloudinary</h2>
                  <p>Download encrypted version (.enc) or original file directly</p>
                </div>
                {encFiles.length === 0 ? (
                  <div className="empty-state">
                    <span className="empty-icon">☁️</span>
                    <p>No saved files yet</p>
                    <small>Encrypt a file from the "Encrypt File" tab and it will appear here</small>
                  </div>
                ) : (
                  <div className="files-list">
                    {encFiles.map((f, i) => (
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
                        <button onClick={() => handleFileDownload(f.id, f.filename)} className="btn btn-sm btn-primary" disabled={loading} title="Decrypt and download original file">🔓 Original</button>
                        <button onClick={() => handleDeleteFile(f.id, f.filename)} className="btn btn-sm btn-danger" title="Delete">🗑️</button>
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={fetchEncFiles} className="btn btn-secondary btn-sm" style={{ marginTop: 12 }}>🔄 Refresh</button>
              </div>
            </div>
          )}

          {/* ══ History Tab ══ */}
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
                                 item.operation_type === 'file_delete'  ? '🗑️ Delete File'  :
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
                <button onClick={fetchHistory} className="btn btn-secondary btn-sm" disabled={loading} style={{ marginTop: 12 }}>🔄 Refresh</button>
              </div>
            </div>
          )}

          {/* ══ Statistics Tab ══ */}
          {activeTab === 'stats' && (
            <div className="tab-panel">
              <div className="card">
                <div className="card-header"><h2>System Statistics</h2></div>
                <div className="stats-grid">
                  {[
                    ['Total Users',      users.length,                                              'var(--accent-primary)'],
                    ['Pending',          pendingCount,                                              'var(--accent-warning)'],
                    ['Approved',         editRequests.filter(r => r.status === 'approved').length, 'var(--accent-success)'],
                    ['Rejected',         editRequests.filter(r => r.status === 'rejected').length, 'var(--accent-danger)'],
                    ['Avg Key Requests', users.length > 0 ? (users.reduce((s,u) => s+(u.key_sent_count||0),0)/users.length).toFixed(1) : 0, 'var(--text-secondary)'],
                    ['Max Key Requests', users.length > 0 ? Math.max(...users.map(u=>u.key_sent_count||0)) : 0, 'var(--text-secondary)'],
                  ].map(([label, val, color]) => (
                    <div key={label} className="stat-card"><h4>{label}</h4><div className="stat-number" style={{ color }}>{val}</div></div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      <footer className="dashboard-footer">
        <p>🛡️ Admin Dashboard — SecureEncrypt © {new Date().getFullYear()}</p>
      </footer>

      {showOTPModal && (
        <OTPModal
          onClose={() => { setShowOTPModal(false); setPendingOp(null); setLoading(false); }}
          onVerify={handleOTPVerify}
          onResend={handleRequestOTP}
          userEmail={user?.email}
        />
      )}
    </div>
  );
};

export default AdminDashboard;