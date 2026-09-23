import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { isValidEmail } from '../lib/supabaseClient';

export default function Login() {
  const { login, toast } = useApp();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const update = (field) => (e) => {
    setErrorMsg('');
    setForm((f) => ({ ...f, [field]: e.target.value }));
  };

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setErrorMsg('');

    if (!isValidEmail(form.email)) {
      const msg = 'Please enter a valid email address.';
      setErrorMsg(msg);
      toast(msg);
      return;
    }
    if (!form.password) {
      const msg = 'Please enter your password.';
      setErrorMsg(msg);
      toast(msg);
      return;
    }

    setSubmitting(true);
    try {
      await login(form);
      toast('Logged in successfully!');
      navigate('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      let msg = err.message || 'Could not log in — check your email and password.';
      if (err.message?.toLowerCase().includes('email not confirmed')) {
        msg = 'Your email has not been confirmed yet. Please check your inbox or turn off "Confirm email" in Supabase settings.';
      } else if (err.message?.toLowerCase().includes('invalid login credentials')) {
        msg = 'Invalid email or password. If you haven\'t created an account yet, click "Create an account" below.';
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
        <h2 style={{ fontSize: 24, marginBottom: 6 }}>Welcome back</h2>
        <p className="muted" style={{ fontSize: 14, marginBottom: 22 }}>Log in with your email and password.</p>

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
            <label>Email Address</label>
            <input
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={update('email')}
              placeholder="name@gmail.com"
              autoFocus
              required
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={update('password')}
              placeholder="••••••••"
              required
            />
          </div>
          <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
            {submitting ? 'Logging in…' : 'Log In'}
          </button>
        </form>
        <p className="muted" style={{ fontSize: 13.5, marginTop: 16, textAlign: 'center' }}>
          New here? <Link to="/signup" style={{ color: 'var(--blue)', fontWeight: 600 }}>Create an account</Link>
        </p>
      </div>
    </div>
  );
}
