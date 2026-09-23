import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { cleanText } from '../lib/supabaseClient';

const CATEGORIES = ['Assignment Guidance', 'Research', 'Proofreading', 'Formatting', 'Presentation', 'Tutoring', 'Project Support', 'Journal Guidance', 'Other'];
const DEADLINES = ['1 day', '2 days', '3 days', '5 days', '1 week', '2 weeks'];
const LEVELS = ['High School', 'Undergraduate', 'Postgraduate', 'Doctoral'];

export default function PostRequest() {
  const { user, authLoading, postRequest, toast } = useApp();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState({
    title: '', category: 'Assignment Guidance', subject: '', academic_level: 'Undergraduate',
    description: '', deadline: '3 days', budget_min: 500, budget_max: 1000,
  });

  if (authLoading) return <div className="wrap" style={{ padding: '60px 0' }}>Loading…</div>;
  if (!user) return <Navigate to="/signup" replace />;

  const update = (field) => (e) => setData((d) => ({ ...d, [field]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    if (!data.title.trim()) { toast('Give it a short title'); return; }
    setSubmitting(true);
    try {
      await postRequest({
        title: cleanText(data.title, 150), category: data.category, subject: cleanText(data.subject, 80),
        academic_level: data.academic_level, description: cleanText(data.description, 2000), deadline: data.deadline,
        budget_min: Math.max(0, Number(data.budget_min) || 0), budget_max: Math.max(0, Number(data.budget_max) || 0),
      });
      toast('Posted — you\'ll see offers on your dashboard');
      navigate('/dashboard');
    } catch (err) {
      toast('Could not post your request — please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="wrap" style={{ paddingTop: 48, paddingBottom: 60 }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <h2 style={{ fontSize: 26, marginBottom: 6 }}>What do you need help with?</h2>
        <p className="muted" style={{ fontSize: 14.5, marginBottom: 26 }}>A few details, then it's live on the board.</p>
        <form onSubmit={handleSubmit} className="card" style={{ padding: 26 }}>
          <div className="field">
            <label>Title</label>
            <input value={data.title} onChange={update('title')} placeholder="e.g. Help structuring a marketing research project" maxLength={150} autoFocus />
          </div>
          <div className="field">
            <label>Category</label>
            <select value={data.category} onChange={update('category')}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 14 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>Subject</label>
              <input value={data.subject} onChange={update('subject')} placeholder="e.g. Marketing" maxLength={80} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Academic level</label>
              <select value={data.academic_level} onChange={update('academic_level')}>
                {LEVELS.map((l) => <option key={l}>{l}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Description</label>
            <textarea rows={4} value={data.description} onChange={update('description')} placeholder="What exactly are you stuck on?" maxLength={2000} />
          </div>
          <div style={{ display: 'flex', gap: 14 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>Deadline</label>
              <select value={data.deadline} onChange={update('deadline')}>
                {DEADLINES.map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Budget (₹, min–max)</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="number" min="0" value={data.budget_min} onChange={update('budget_min')} />
                <input type="number" min="0" value={data.budget_max} onChange={update('budget_max')} />
              </div>
            </div>
          </div>
          <div className="field-hint" style={{ marginBottom: 16 }}>
            You'll pay your maximum budget only after you approve the help you receive.
          </div>
          <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
            {submitting ? 'Posting…' : 'Post It'}
          </button>
        </form>
      </div>
    </section>
  );
}
