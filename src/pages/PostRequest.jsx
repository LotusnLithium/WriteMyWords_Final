import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { cleanText, uploadAttachment } from '../lib/supabaseClient';

const CATEGORIES = ['Assignment Guidance', 'Research', 'Proofreading', 'Formatting', 'Presentation', 'Tutoring', 'Project Support', 'Journal Guidance', 'Other'];
const DEADLINES = ['1 day', '2 days', '3 days', '5 days', '1 week', '2 weeks'];
const LEVELS = ['High School', 'Undergraduate', 'Postgraduate', 'Doctoral'];

export default function PostRequest() {
  const { user, authLoading, postRequest, toast } = useApp();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [file, setFile] = useState(null);
  const [data, setData] = useState({
    title: '',
    category: 'Assignment Guidance',
    subject: '',
    academic_level: 'Undergraduate',
    description: '',
    deadline: '3 days',
    budget_min: 500,
    budget_max: 1000,
  });

  if (authLoading) return <div className="wrap" style={{ padding: '60px 0' }}>Loading…</div>;
  if (!user) return <Navigate to="/signup" replace />;

  const update = (field) => (e) => setData((d) => ({ ...d, [field]: e.target.value }));

  function handleFileChange(e) {
    const selected = e.target.files?.[0];
    if (selected) {
      // 25MB max size limit check
      if (selected.size > 25 * 1024 * 1024) {
        toast('File is too large. Please select a file under 25MB.');
        return;
      }
      setFile(selected);
    }
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    if (!data.title.trim()) { toast('Please give your request a short title.'); return; }
    
    setSubmitting(true);
    setUploadStatus(file ? 'Uploading document…' : 'Posting request…');

    try {
      let attachmentUrl = null;
      let attachmentName = null;

      if (file) {
        try {
          const uploaded = await uploadAttachment(file, 'assignments');
          if (uploaded) {
            attachmentUrl = uploaded.url;
            attachmentName = uploaded.name;
          }
        } catch (uploadErr) {
          console.warn('Storage upload note:', uploadErr);
          // Still proceed with attachment name if storage bucket was not created yet
          attachmentName = file.name;
        }
      }

      setUploadStatus('Saving request…');
      await postRequest({
        title: cleanText(data.title, 150),
        requester_name: cleanText(user?.name || 'Student', 100),
        category: data.category,
        subject: cleanText(data.subject, 80),
        academic_level: data.academic_level,
        description: cleanText(data.description, 2000),
        deadline: data.deadline,
        budget_min: Math.max(0, Number(data.budget_min) || 0),
        budget_max: Math.max(0, Number(data.budget_max) || 0),
        attachment_url: attachmentUrl,
        attachment_name: attachmentName,
      });

      toast('Posted! Your request is now live on the board.');
      navigate('/dashboard');
    } catch (err) {
      console.error('Post request error:', err);
      toast('Could not post your request — please try again.');
    } finally {
      setSubmitting(false);
      setUploadStatus('');
    }
  }

  return (
    <section className="wrap" style={{ paddingTop: 48, paddingBottom: 60 }}>
      <div style={{ maxWidth: 580, margin: '0 auto' }}>
        <h2 style={{ fontSize: 26, marginBottom: 6 }}>What do you need help with?</h2>
        <p className="muted" style={{ fontSize: 14.5, marginBottom: 26 }}>
          Add the assignment details and document brief, then it goes live on the board.
        </p>

        <form onSubmit={handleSubmit} className="card" style={{ padding: 28 }}>
          <div className="field">
            <label>Title</label>
            <input
              value={data.title}
              onChange={update('title')}
              placeholder="e.g. Help structuring a marketing research project"
              maxLength={150}
              autoFocus
              required
            />
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
              <input value={data.subject} onChange={update('subject')} placeholder="e.g. Marketing / Economics" maxLength={80} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Academic level</label>
              <select value={data.academic_level} onChange={update('academic_level')}>
                {LEVELS.map((l) => <option key={l}>{l}</option>)}
              </select>
            </div>
          </div>

          <div className="field">
            <label>Description & Requirements</label>
            <textarea
              rows={4}
              value={data.description}
              onChange={update('description')}
              placeholder="Describe what you are stuck on, specific topics, questions, or guidance needed…"
              maxLength={2000}
            />
          </div>

          {/* Document / Assignment Brief Upload Section for Work Provider */}
          <div className="field">
            <label>Attach Assignment Document / Brief (Optional)</label>
            <div className="file-upload-box">
              <input
                type="file"
                id="assignment-file-input"
                onChange={handleFileChange}
                accept=".doc,.docx,.pdf,.txt,.rtf,.png,.jpg,.jpeg,.zip"
                style={{ display: 'none' }}
              />
              
              {!file ? (
                <label htmlFor="assignment-file-input" className="file-upload-label">
                  <div style={{ fontSize: 28, marginBottom: 6 }}>📄</div>
                  <div style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--ink)' }}>
                    Click to browse or upload assignment file
                  </div>
                  <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
                    Supports Word (.docx, .doc), PDF, Text (.txt), Images (up to 25MB)
                  </div>
                </label>
              ) : (
                <div className="file-selected-badge">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
                    <span style={{ fontSize: 22 }}>📎</span>
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontWeight: 600, fontSize: 14, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {file.name}
                      </div>
                      <div className="muted" style={{ fontSize: 12 }}>{formatBytes(file.size)}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="btn btn-ghost btn-sm"
                    style={{ color: 'var(--error)', borderColor: 'rgba(217,85,85,0.2)', padding: '4px 10px' }}
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
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

          <div className="field-hint" style={{ marginBottom: 18 }}>
            💡 You will pay your maximum budget only after you approve the deliverable you receive.
          </div>

          <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
            {submitting ? (uploadStatus || 'Posting…') : 'Post Request'}
          </button>
        </form>
      </div>
    </section>
  );
}
