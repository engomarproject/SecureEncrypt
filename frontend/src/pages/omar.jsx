import React from 'react';
import '../App.css';

const Omar = () => {
  return (
    <div className="omar-page-container">
      <header className="omar-header">
        <h1 className="omar-page-title">
          <span className="title-en">Encryption Guide</span>
        </h1>
      </header>

      {/* ================= Section 1: Introduction ================= */}
      <section className="omar-section">
        <h2 className="omar-section-heading">
          <span className="heading-en">1. Introduction to Encryption</span>
        </h2>

        <div className="lang-block lang-en">
          <h3 className="omar-subheading">What is Encryption?</h3>
          <p className="omar-text">
            Encryption is the process of converting readable data <strong>(Plaintext)</strong> into
            an unreadable format <strong>(Ciphertext)</strong> using complex mathematical algorithms.
            It ensures that only authorized parties with the correct <strong>"Key"</strong> can
            access the information.
          </p>

          <h3 className="omar-subheading">Why is it Important?</h3>
          <ul className="omar-list">
            <li className="omar-list-item">
              <strong>Privacy:</strong> Protects your personal conversations on apps like WhatsApp.
            </li>
            <li className="omar-list-item">
              <strong>Security:</strong> Secures online banking and credit card transactions.
            </li>
            <li className="omar-list-item">
              <strong>Data Integrity:</strong> Ensures that data has not been altered during
              transmission.
            </li>
          </ul>
        </div>
      </section>

      {/* ================= Section 2: Encryption Types ================= */}
      <section className="omar-section">
        <h2 className="omar-section-heading">
          <span className="heading-en">2. Encryption Types</span>
        </h2>

        <div className="lang-block lang-en">
          <div className="type-card">
            <h3 className="omar-subheading">A. Symmetric Encryption</h3>
            <p className="omar-text">
              It uses a <strong>single key</strong> for both encryption and decryption. It is fast
              and ideal for encrypting large amounts of data.
            </p>
            <div className="example-box">
              <strong>Example:</strong> AES Algorithm.
            </div>
          </div>

          <div className="type-card">
            <h3 className="omar-subheading">B. Asymmetric Encryption</h3>
            <p className="omar-text">
              It uses a <strong>pair of keys</strong>: a <em>Public Key</em> (to encrypt) and a{' '}
              <em>Private Key</em> (to decrypt).
            </p>
            <div className="example-box">
              <strong>Example:</strong> RSA Algorithm.
            </div>
          </div>
        </div>
      </section>

      {/* ================= Section 3: Fernet Technology ================= */}
      <section className="omar-section">
        <h2 className="omar-section-heading">
          <span className="heading-en">3. Our Core Technology: Fernet</span>
        </h2>

        <div className="lang-block lang-en">
          <h3 className="omar-subheading">What is Fernet?</h3>
          <p className="omar-text">
            Fernet is an implementation of <strong>symmetric authenticated cryptography</strong>. It
            is built on top of the <strong>AES standard</strong> and designed to provide both high
            security and ease of use.
          </p>

          <h3 className="omar-subheading">Why we chose Fernet?</h3>
          <div className="fernet-features">
            <div className="feature-item">
              <div className="feature-icon">🛡️</div>
              <div className="feature-content">
                <strong>1. Tamper-proof:</strong> Uses <code>HMAC</code> to ensure that if the
                ciphertext is modified, it cannot be decrypted.
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">⏰</div>
              <div className="feature-content">
                <strong>2. Time-stamping:</strong> Can record when a message was encrypted to set
                an expiration time.
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">🔐</div>
              <div className="feature-content">
                <strong>3. High Security:</strong> Uses <code>AES-128</code> in CBC mode, providing
                "Military Grade" protection.
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Omar;