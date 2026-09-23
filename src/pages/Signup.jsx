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
  const [website, setWebsite] = useState(''); // honeypot — real users never see or fill this
  const [submitting, setSubmitting] = useState(false);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    if (website) return; // silently drop likely-bot submissions
    if (!cleanText(form.name)) { toast('Add your name to continue'); return; }
    if (!isValidEmail(form.email)) { toast('Enter a valid email address'); return; }
    if (!isValidWhatsapp(form.whatsapp)) { toast('Enter a valid WhatsApp number with country code'); return; }
    if (!isStrongPassword(form.password)) { toast('Password needs 8+ characters with a letter and a number'); return; }

    setSubmitting(true);
    try {
      const result = await signup({
        name: cleanText(form.name, 100), email: form.email.trim(), whatsapp: form.whatsapp.trim(), role,
        password: form.password,
      });
      if (result.needsConfirmation) {
        toast('Check your email to confirm your account, then log in.');
        navigate('/login');
      } else {
        toast(role === 'expert' ? 'Expert account created' : `You're all set, ${form.name}`);
        navigate(role === 'expert' ? '/expert-dashboard' : '/dashboard/requests/new');
      }
    } catch (err) {
      toast(err.message?.includes('already registered') ? 'An account with that email already exists.' : 'Something went wrong — please try again.');
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
        <form onSubmit={handleSubmit}>
          {/* Honeypot field: hidden from real users via CSS, but a naive bot
              filling every input will fill this too, so we can drop the submission. */}
          <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
            <label htmlFor="website">Website</label>
            <input id="website" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </div>
          <div className="field">
            <label>{role === 'expert' ? 'Full name' : 'First name'}</label>
            <input value={form.name} onChange={update('name')} placeholder="Jordan" autoFocus maxLength={100} />
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" autoComplete="email" value={form.email} onChange={update('email')} placeholder="you@school.edu" />
          </div>
          <div className="field">
            <label>WhatsApp number</label>
            <input type="tel" value={form.whatsapp} onChange={update('whatsapp')} placeholder="+91 98765 43210" />
            <div className="field-hint">Include your country code.</div>
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" autoComplete="new-password" value={form.password} onChange={update('password')} placeholder="At least 8 characters" />
            <div className="field-hint">8+ characters, with at least one letter and one number.</div>
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
