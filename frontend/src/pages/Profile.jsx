import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import '../App.css';

const Profile = () => {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [profile,        setProfile]        = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [saving,         setSaving]         = useState(false);
  const [error,          setError]          = useState('');
  const [success,        setSuccess]        = useState('');
  const [isEditing,      setIsEditing]      = useState(false);
  const [pendingRequest, setPendingRequest] = useState(null);
  const [editData, setEditData] = useState({ full_name: '', bio: '' });

  useEffect(() => {
    fetchProfile();
    fetchPendingRequest();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await api.get('/user/profile');
      if (res.data.success) {
        const p = res.data.data.user;
        setProfile(p);
        setEditData({ full_name: p.full_name || '', bio: p.bio || '' });
      }
    } catch (err) {
      setError(err.message || 'Failed to load account data');
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingRequest = async () => {
    try {
      const res = await api.get('/user/edit-request');
      if (res.data.success && res.data.data.request) {
        const req = res.data.data.request;
        if (req.status === 'pending') {
          setPendingRequest(req);
        } else {
          setPendingRequest(null);
        }
      }
    } catch {
      setPendingRequest(null);
    }
  };

  const handleSendKey = async () => {
    setSaving(true); setError(''); setSuccess('');
    try {
      const res = await api.post('/send-key');
      if (res.data.success) setSuccess('Encryption key sent to your email');
    } catch (err) {
      setError(err.message || 'Failed to send key');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitEdit = async (e) => {
    e.preventDefault();
    if (!editData.full_name.trim()) { setError('Full name is required'); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      const res = await api.post('/user/request-edit', editData);
      if (res.data.success) {
        setSuccess('Edit request sent. It will be applied after admin approval.');
        setIsEditing(false);
        fetchPendingRequest();
      }
    } catch (err) {
      setError(err.message || 'Failed to send edit request');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (ts) => {
    if (!ts) return 'Not available';
    const d = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
    return d.toLocaleString('en-US');
  };

  return (
    <div className="profile-page">
      <header className="profile-header dashboard-header">
        <div className="header-content">
          <div className="logo-section">
            <span className="logo-icon">👤</span>
            <h1>My Profile</h1>
          </div>
          {/* الأدمن يرجع لـ /admin والمستخدم العادي يرجع لـ /dashboard */}
          <button
            onClick={() => navigate(isAdmin ? '/admin' : '/dashboard')}
            className="btn btn-secondary"
          >
            ← Back to {isAdmin ? 'Admin Panel' : 'Dashboard'}
          </button>
        </div>
      </header>

      <main className="profile-main">
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

        {loading ? (
          <div className="loading-state"><span className="spinner"></span> Loading data...</div>
        ) : profile ? (
          <div className="profile-container">

            {/* Data Card */}
            <div className="card profile-card">
              <div className="profile-avatar">
                <span className="avatar-text">
                  {(profile.full_name || profile.email || '?')[0].toUpperCase()}
                </span>
              </div>
              <div className="profile-info" style={{ flex: 1 }}>
                <h2>{profile.full_name || 'User'}</h2>
                <p className="profile-email">{profile.email}</p>

                {/* Admin Badge */}
                {isAdmin && (
                  <span className="badge badge-warning" style={{ fontSize: 11, marginBottom: 8, display: 'inline-block' }}>
                    🛡️ Admin
                  </span>
                )}

                <div className="profile-meta">
                  <div className="meta-item">
                    <strong>Created:</strong>
                    <span>{formatDate(profile.created_at)}</span>
                  </div>
                  <div className="meta-item">
                    <strong>Key Requests:</strong>
                    <span>{profile.key_sent_count || 0} times</span>
                  </div>
                  <div className="meta-item">
                    <strong>Last Key Request:</strong>
                    <span>{formatDate(profile.last_key_request)}</span>
                  </div>
                  <div className="meta-item">
                    <strong>Account Status:</strong>
                    <span className={`status ${profile.is_active ? 'active' : 'inactive'}`}>
                      {profile.is_active ? '✅ Active' : '❌ Disabled'}
                    </span>
                  </div>
                  {profile.bio && (
                    <div className="meta-item">
                      <strong>Bio:</strong>
                      <span>{profile.bio}</span>
                    </div>
                  )}
                </div>

                {/* Show message only if pending */}
                {pendingRequest && (
                  <div className="pending-note">
                    ⏳ You have a pending edit request under admin review
                  </div>
                )}

                {/* Edit button — only shows if no pending request */}
                {!pendingRequest && (
                  <div style={{ marginTop: 16 }}>
                    {!isEditing ? (
                      <button onClick={() => setIsEditing(true)} className="btn btn-primary btn-sm">
                        ✏️ Edit My Info
                      </button>
                    ) : (
                      <form onSubmit={handleSubmitEdit} className="edit-form">
                        <div className="form-group">
                          <label>Full Name</label>
                          <input
                            type="text"
                            className="form-input"
                            value={editData.full_name}
                            onChange={e => setEditData(d => ({ ...d, full_name: e.target.value }))}
                            disabled={saving}
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label>Bio (Optional)</label>
                          <textarea
                            className="form-textarea"
                            rows="3"
                            value={editData.bio}
                            onChange={e => setEditData(d => ({ ...d, bio: e.target.value }))}
                            disabled={saving}
                            placeholder="Write a short bio..."
                          />
                        </div>
                        <div className="alert alert-warning" style={{ fontSize: 13 }}>
                          ⚠️ The edit request will be sent to admin for review and approval.
                        </div>
                        <div className="button-group">
                          <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                            {saving ? <><span className="spinner"></span> Sending...</> : '📤 Send Edit Request'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => { setIsEditing(false); setError(''); }}
                            disabled={saving}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Account Security Card */}
            <div className="card security-card">
              <h3>🔐 Account Security</h3>
              <p style={{ marginTop: 8, marginBottom: 16, fontSize: 14, color: 'var(--text-secondary)' }}>
                The encryption key is the only key to decrypt all your encrypted data. Keep it in a safe place.
              </p>
              <button onClick={handleSendKey} disabled={saving} className="btn btn-warning btn-lg">
                {saving ? 'Sending...' : '📧 Send Key to My Email'}
              </button>
            </div>

          </div>
        ) : (
          <div className="empty-state">
            <span className="empty-icon">👤</span>
            <p>Failed to load account data</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Profile;