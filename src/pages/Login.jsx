import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { isValidEmail } from '../lib/supabaseClient';

export default function Login() {
  const { login, toast } = useApp();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return; // basic throttle: no double-submits on slow taps
    if (!isValidEmail(form.email)) { toast('Enter a valid email address'); return; }
    if (!form.password) { toast('Enter your password'); return; }
    setSubmitting(true);
    try {
      await login(form);
      toast('Logged in successfully!');
      navigate('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      if (err.message?.toLowerCase().includes('email not confirmed')) {
        toast('Please check your email inbox to confirm your account first.');
      } else if (err.message?.toLowerCase().includes('invalid login credentials')) {
        toast('Invalid email or password. If you haven\'t signed up yet, click "Create an account" below.');
      } else {
        toast(err.message || 'Could not log in — check your email and password.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h2 style={{ fontSize: 24, marginBottom: 6 }}>Welcome back</h2>
        <p className="muted" style={{ fontSize: 14, marginBottom: 22 }}>Log in with your email and password.</p>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Email</label>
            <input type="email" autoComplete="email" value={form.email} onChange={update('email')} placeholder="you@school.edu" autoFocus />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" autoComplete="current-password" value={form.password} onChange={update('password')} placeholder="••••••••" />
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
