import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { cleanText, isStrongPassword, isValidEmail, isValidWhatsapp } from '../lib/supabaseClient';

export default function Signup() {
  const { signup, toast } = useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const role = params.get('role') === 'expert' ? 'expert' : 'student';
  const [form, setForm] = useState({ name: '', email: '', whatsapp: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

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
    if (!isValidWhatsapp(form.whatsapp)) {
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
        whatsapp: form.whatsapp.trim(),
        role,
        password: form.password,
      });
      if (result.needsConfirmation) {
        toast('Account created! Please check your email inbox to confirm, or turn off email confirmation in Supabase.');
        navigate('/login');
      } else {
        toast(role === 'expert' ? 'Expert account created!' : `Welcome to WriteMyWords, ${form.name}!`);
        navigate(role === 'expert' ? '/board' : '/dashboard');
      }
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
            <label>{role === 'expert' ? 'Full name' : 'First name'}</label>
            <input
              value={form.name}
              onChange={update('name')}
              placeholder="e.g. Jordan"
              autoFocus
              maxLength={100}
              required
            />
          </div>
          <div className="field">
            <label>Email</label>
            <input
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={update('email')}
              placeholder="you@gmail.com"
              required
            />
          </div>
          <div className="field">
            <label>WhatsApp number</label>
            <input
              type="tel"
              value={form.whatsapp}
              onChange={update('whatsapp')}
              placeholder="+91 98765 43210"
              required
            />
            <div className="field-hint">Include your country code.</div>
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
    </div>
  );
}
