import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { IconCheck, IconCheckCircle, IconCopy, IconEye, IconEyeOff, IconKey, IconMail, IconShield } from './Icons.jsx';

export default function AccountCreatedModal({ userDetails, onProceed, toast }) {
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!userDetails) return null;

  const { name, email, password, role } = userDetails;

  function copyCredentials() {
    const textToCopy = `WriteMyWords Login Credentials\nLogin ID (Email): ${email}\nPassword: ${password}\nRole: ${role === 'expert' ? 'Helper / Expert' : 'Student (Poster)'}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    if (toast) toast('Credentials copied to clipboard!');
    setTimeout(() => setCopied(false), 3000);
  }

  const modalContent = (
    <div className="invoice-overlay" style={{ zIndex: 999999 }}>
      <div className="auth-card" style={{ maxWidth: 480, width: '100%', margin: 'auto', background: '#fff', position: 'relative' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(47, 143, 104, 0.1)', color: 'var(--success)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <IconCheckCircle size={32} color="var(--success)" />
          </div>
          <h2 style={{ fontSize: 22, color: 'var(--ink)' }}>Account Created Successfully</h2>
          <p className="muted" style={{ fontSize: 14, marginTop: 4 }}>
            Welcome to WriteMyWords, <strong>{name}</strong>. Your account has been registered and is ready to use.
          </p>
        </div>

        {/* Credentials Card */}
        <div style={{
          background: 'var(--soft-blue)',
          border: '1.5px solid rgba(49, 87, 213, 0.2)',
          borderRadius: 'var(--r-md)',
          padding: '16px 18px',
          marginBottom: 20,
        }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <IconKey size={14} color="var(--blue)" /> Your Account Login Credentials
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(49, 87, 213, 0.12)', fontSize: 13.5 }}>
            <span className="muted">Login ID / Email:</span>
            <strong style={{ color: 'var(--ink)', wordBreak: 'break-all' }}>{email}</strong>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(49, 87, 213, 0.12)', fontSize: 13.5 }}>
            <span className="muted">Password:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <strong style={{ color: 'var(--ink)', fontFamily: showPassword ? 'inherit' : 'monospace' }}>
                {showPassword ? password : '••••••••'}
              </strong>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowPassword((p) => !p)}
                style={{ padding: '2px 8px', fontSize: 12, minHeight: 26, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <IconEyeOff size={13} /> : <IconEye size={13} />}
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', fontSize: 13.5 }}>
            <span className="muted">Account Role:</span>
            <span className="badge" style={{ fontSize: 11 }}>
              {role === 'expert' ? 'Expert Helper' : 'Student (Poster)'}
            </span>
          </div>

          <button
            type="button"
            className="btn btn-ghost btn-block btn-sm"
            onClick={copyCredentials}
            style={{ marginTop: 12, borderColor: 'var(--blue)', color: 'var(--blue)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            {copied ? (
              <>
                <IconCheck size={14} color="var(--blue)" /> Credentials Copied!
              </>
            ) : (
              <>
                <IconCopy size={14} color="var(--blue)" /> Copy Login Details
              </>
            )}
          </button>
        </div>

        <div style={{ background: '#ecfdf5', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 12.5, color: '#065f46', display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconMail size={16} color="#065f46" style={{ flexShrink: 0 }} />
          <div>
            <strong>Email Notice:</strong> Your login details and account confirmation are saved for <strong>{email}</strong>.
          </div>
        </div>

        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={onProceed}
          style={{ fontSize: 15, padding: '14px 20px' }}
        >
          Proceed to Dashboard →
        </button>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
