import React from 'react';
import { Link } from 'react-router-dom';
import '../App.css';

const Home = () => {
  return (
    <div className="home-container">

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <header className="hero-section">
        <div className="hero-content">
          <div className="hero-badge">🔒 Secure Encryption Tool</div>
          <h1>Protect Your Data with the Latest<br />Encryption Technologies</h1>
          <p className="hero-subtitle">
            SecureEncrypt is a comprehensive web platform that uses the advanced Fernet algorithm
            to protect your texts and files with ease and security.
          </p>
          
          {/* ✅ "Start Learning" button added here */}
          <div className="hero-buttons">
            <Link to="/register" className="btn btn-primary btn-lg">Start for Free</Link>
            <Link to="/omar" className="btn btn-outline btn-lg">📖 Start Learning</Link>
            <Link to="/login" className="btn btn-outline btn-lg">🔑 Login</Link>
          </div>

          <div className="hero-stats">
            <div className="hero-stat"><span className="stat-num">AES-128</span><span className="stat-label">Encryption Algorithm</span></div>
            <div className="hero-stat-divider"></div>
            <div className="hero-stat"><span className="stat-num">OTP</span><span className="stat-label">Two-Factor Authentication</span></div>
            <div className="hero-stat-divider"></div>
            <div className="hero-stat"><span className="stat-num">50MB</span><span className="stat-label">File Upload Limit</span></div>
          </div>
        </div>

        {/* Preview Card */}
        <div className="hero-preview">
          <div className="preview-card">
            <div className="preview-header">
              <span className="preview-dot red"></span>
              <span className="preview-dot yellow"></span>
              <span className="preview-dot green"></span>
              <span className="preview-title">SecureEncrypt</span>
            </div>
            <div className="preview-body">
              <div className="preview-label">Original Text</div>
              <div className="preview-text">Highly confidential and important data</div>
              <div className="preview-arrow">↓ Encrypt</div>
              <div className="preview-label">Encrypted Text</div>
              <div className="preview-encrypted">gAAAAABk7X2mN3p...</div>
              <div className="preview-badge">🔐 Protected by Fernet</div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Features ──────────────────────────────────────────────── */}
      <section className="features-section">
        <div className="section-header">
          <h2>Why Choose SecureEncrypt?</h2>
          <p className="section-subtitle">Everything you need to protect your data in one place</p>
        </div>
        <div className="features-grid">
          {[
            { icon: '🔒', title: 'Fernet Encryption', desc: 'AES-128-CBC algorithm with HMAC-SHA256 to ensure complete confidentiality and data integrity.', color: 'blue' },
            { icon: '🌐', title: 'Easy Web Interface', desc: 'No software installation needed. Run from any browser on any device in seconds.', color: 'teal' },
            { icon: '🛡️', title: 'OTP Verification', desc: 'A verification code sent to your email before every decryption operation for an extra layer of security.', color: 'purple' },
            { icon: '📁', title: 'File Encryption', desc: 'Encrypt documents, images, and text files and download them securely at any time.', color: 'orange' },
          ].map((f) => (
            <div key={f.title} className={`feature-card feature-${f.color}`}>
              <div className="feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ──────────────────────────────────────────────── */}
      <section className="how-section">
        <div className="section-header">
          <h2>How It Works?</h2>
          <p className="section-subtitle">Three simple steps to protect your data</p>
        </div>
        <div className="steps-grid">
          {[
            { num: '01', title: 'Create Your Account', desc: 'Sign up for free and a unique encryption key is automatically generated for you.' },
            { num: '02', title: 'Encrypt Your Data', desc: 'Enter your text or upload your file to be encrypted with your personal key.' },
            { num: '03', title: 'Decrypt Securely', desc: 'Enter the key and verify with OTP to restore your original data.' },
          ].map((s) => (
            <div key={s.num} className="step-card">
              <div className="step-num">{s.num}</div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────── */}
      <section className="cta-section" style={{ color: "#fff" }}>
        <div className="cta-content">
          <h2 style={{ color: "#fff" }}>Start Protecting Your Data Now</h2>
          <p style={{ color: "#fff" }}>Completely free, no credit card required</p>

          <div className="hero-buttons" style={{ justifyContent: 'center' }}>
            <Link to="/register" className="btn btn-primary btn-lg">Create Free Account</Link>
            <Link to="/omar" className="btn btn-outline btn-lg">📖 Start Learning</Link>
            <Link to="/login" className="btn btn-outline btn-lg">Login</Link>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <footer className="home-footer">
        <p>© {new Date().getFullYear()} SecureEncrypt. All rights reserved.</p>
      </footer>

    </div>
  );
};

export default Home;