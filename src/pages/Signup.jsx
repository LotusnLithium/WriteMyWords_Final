import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { cleanText, isStrongPassword, isValidEmail, isValidWhatsapp } from '../lib/supabaseClient';
import { sendAccountCreatedEmail } from '../lib/emailService';
import AccountCreatedModal from '../components/AccountCreatedModal.jsx';

const COUNTRY_CODES = [
  { code: '+91', country: 'India', flag: '🇮🇳', placeholder: '98765 43210' },
  { code: '+1', country: 'United States / Canada', flag: '🇺🇸', placeholder: '202 555 0123' },
  { code: '+44', country: 'United Kingdom', flag: '🇬🇧', placeholder: '7911 123456' },
  { code: '+971', country: 'United Arab Emirates', flag: '🇦🇪', placeholder: '50 123 4567' },
  { code: '+61', country: 'Australia', flag: '🇦🇺', placeholder: '412 345 678' },
  { code: '+65', country: 'Singapore', flag: '🇸🇬', placeholder: '8123 4567' },
  { code: '+966', country: 'Saudi Arabia', flag: '🇸🇦', placeholder: '50 123 4567' },
  { code: '+974', country: 'Qatar', flag: '🇶🇦', placeholder: '3312 3456' },
  { code: '+49', country: 'Germany', flag: '🇩🇪', placeholder: '151 12345678' },
  { code: '+33', country: 'France', flag: '🇫🇷', placeholder: '6 12 34 56 78' },
  { code: '+92', country: 'Pakistan', flag: '🇵🇰', placeholder: '300 1234567' },
  { code: '+880', country: 'Bangladesh', flag: '🇧🇩', placeholder: '1712 345678' },
  { code: '+977', country: 'Nepal', flag: '🇳🇵', placeholder: '984 1234567' },
  { code: '+94', country: 'Sri Lanka', flag: '🇱🇰', placeholder: '71 234 5678' },
  { code: '+60', country: 'Malaysia', flag: '🇲🇾', placeholder: '12 345 6789' },
  { code: '+64', country: 'New Zealand', flag: '🇳🇿', placeholder: '21 123 4567' },
  { code: '+234', country: 'Nigeria', flag: '🇳🇬', placeholder: '802 123 4567' },
  { code: '+27', country: 'South Africa', flag: '🇿🇦', placeholder: '71 123 4567' },
  { code: '+353', country: 'Ireland', flag: '🇮🇪', placeholder: '83 123 4567' },
  { code: '+31', country: 'Netherlands', flag: '🇳🇱', placeholder: '6 12345678' },
  { code: '+55', country: 'Brazil', flag: '🇧🇷', placeholder: '11 91234 5678' },
  { code: '+63', country: 'Philippines', flag: '🇵🇭', placeholder: '917 123 4567' },
  { code: '+62', country: 'Indonesia', flag: '🇮🇩', placeholder: '812 3456 7890' },
  { code: '+81', country: 'Japan', flag: '🇯🇵', placeholder: '90 1234 5678' },
  { code: '+82', country: 'South Korea', flag: '🇰🇷', placeholder: '10 1234 5678' },
];

export default function Signup() {
  const { signup, toast } = useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const role = params.get('role') === 'expert' ? 'expert' : 'student';
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [createdSuccess, setCreatedSuccess] = useState(null);

  const selectedCountry = COUNTRY_CODES.find((c) => c.code === countryCode) || COUNTRY_CODES[0];

  function update(field) {
    return (e) => {
      setErrorMsg('');
      setForm((f) => ({ ...f, [field]: e.target.value }));
    };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setErrorMsg('');

    if (!cleanText(form.name)) {
      const msg = 'Please enter your name.';
      setErrorMsg(msg);
      toast(msg);
      return;
    }
    if (!isValidEmail(form.email)) {
      const msg = 'Please enter a valid email address.';
      setErrorMsg(msg);
      toast(msg);
      return;
    }

    const fullWhatsapp = `${countryCode} ${phoneNumber.trim()}`;
    if (!phoneNumber.trim() || !isValidWhatsapp(fullWhatsapp)) {
      const msg = 'Please enter a valid WhatsApp / phone number (at least 7 digits).';
      setErrorMsg(msg);
      toast(msg);
      return;
    }
    if (!isStrongPassword(form.password)) {
      const msg = 'Password must be at least 6 characters.';
      setErrorMsg(msg);
      toast(msg);
      return;
    }

    setSubmitting(true);
    try {
      const result = await signup({
        name: cleanText(form.name, 100),
        email: form.email.trim(),
        whatsapp: fullWhatsapp,
        role,
        password: form.password,
      });

      // Send Welcome / Confirmation Email containing credentials
      try {
        await sendAccountCreatedEmail({
          name: cleanText(form.name, 100),
          email: form.email.trim(),
          password: form.password,
          role,
        });
      } catch (emailErr) {
        console.warn('Welcome email trigger notice:', emailErr);
      }

      const destination = role === 'expert' ? '/board' : '/dashboard';

      if (result.needsConfirmation) {
        toast('Account created! Confirmation email with login credentials sent.');
      } else {
        toast(role === 'expert' ? 'Expert account created!' : `Welcome to WriteMyWords, ${form.name}!`);
      }

      // Show the credentials modal so user has their Login ID and password directly
      setCreatedSuccess({
        name: cleanText(form.name, 100),
        email: form.email.trim(),
        password: form.password,
        role,
        destination,
      });
    } catch (err) {
      console.error('Signup error:', err);
      let msg = err.message || 'Could not create account — please try again.';
      if (err.message?.toLowerCase().includes('already registered')) {
        msg = 'An account with that email already exists. Please log in.';
      } else if (err.message?.toLowerCase().includes('rate limit')) {
        msg = 'Email rate limit reached. Please disable "Confirm email" in your Supabase Auth settings to test instantly.';
      } else if (err.message?.toLowerCase().includes('email_address_invalid')) {
        msg = 'Please enter a valid email provider (e.g. yourname@gmail.com).';
      }
      setErrorMsg(msg);
      toast(msg);
    } finally {
      setSubmitting(false);
    }
  }

  function handleProceed() {
    const dest = createdSuccess?.destination || '/dashboard';
    setCreatedSuccess(null);
    navigate(dest);
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h2 style={{ fontSize: 24, marginBottom: 6 }}>
          {role === 'expert' ? 'Become an expert' : "Let's get you set up"}
        </h2>
        <p className="muted" style={{ fontSize: 14, marginBottom: 22 }}>
          {role === 'expert' ? 'Set up your profile and start finding requests.' : "Just your details — you can post your first request right after."}
        </p>

        {errorMsg && (
          <div style={{
            background: 'rgba(217, 85, 85, 0.1)',
            border: '1px solid var(--error)',
            color: 'var(--error)',
            padding: '10px 14px',
            borderRadius: 'var(--r-sm)',
            fontSize: '13.5px',
            marginBottom: '18px',
            lineHeight: '1.4',
          }}>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>{role === 'expert' ? 'Full name' : 'Full Name'}</label>
            <input
              value={form.name}
              onChange={update('name')}
              placeholder="e.g. Rahul Sharma"
              autoFocus
              maxLength={100}
              required
            />
          </div>

          <div className="field">
            <label>Email Address</label>
            <input
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={update('email')}
              placeholder="name@gmail.com"
              required
            />
          </div>

          <div className="field">
            <label>WhatsApp / Phone number</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                style={{
                  width: 'auto',
                  minWidth: '108px',
                  maxWidth: '135px',
                  flexShrink: 0,
                  padding: '11px 8px',
                  borderRadius: 'var(--r-sm)',
                  border: '1px solid var(--border-strong)',
                  fontFamily: 'inherit',
                  fontSize: '15px',
                  background: 'var(--warm-white)',
                  color: 'var(--ink)',
                  cursor: 'pointer',
                }}
                aria-label="Country Code"
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code + c.country} value={c.code}>
                    {c.flag} {c.code} ({c.country})
                  </option>
                ))}
              </select>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => {
                  setErrorMsg('');
                  setPhoneNumber(e.target.value);
                }}
                placeholder={`e.g. ${selectedCountry.placeholder}`}
                required
                style={{ flex: 1, minWidth: 0 }}
              />
            </div>
            <div className="field-hint">We'll send important assignment updates here.</div>
          </div>

          <div className="field">
            <label>Password</label>
            <input
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={update('password')}
              placeholder="At least 6 characters"
              required
            />
            <div className="field-hint">At least 6 characters.</div>
          </div>

          <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
            {submitting ? 'Creating account…' : role === 'expert' ? 'Create Expert Account' : 'Get Started'}
          </button>
        </form>

        <p className="muted" style={{ fontSize: 13.5, marginTop: 16, textAlign: 'center' }}>
          Already have an account? <Link to="/login" style={{ color: 'var(--blue)', fontWeight: 600 }}>Log in</Link>
        </p>
        <p className="muted" style={{ fontSize: 12.5, marginTop: 18, textAlign: 'center' }}>
          {role === 'expert'
            ? <>Are you a student? <Link to="/signup" style={{ color: 'var(--blue)', fontWeight: 600 }}>Sign up here</Link></>
            : <>Are you an expert? <Link to="/signup?role=expert" style={{ color: 'var(--blue)', fontWeight: 600 }}>Join as an expert</Link></>}
        </p>
      </div>

      {createdSuccess && (
        <AccountCreatedModal
          userDetails={createdSuccess}
          onProceed={handleProceed}
          toast={toast}
        />
      )}
    </div>
  );
}

