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
    amount: 1000,
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
    const exactAmount = Math.max(0, Number(data.amount) || 0);
    if (exactAmount <= 0) { toast('Please enter a valid payment amount (₹).'); return; }
    
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
        budget_min: exactAmount,
        budget_max: exactAmount,
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
    <section className="wrap" style={{ paddingTop: 'clamp(24px, 5vw, 48px)', paddingBottom: 'clamp(32px, 5vw, 60px)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <h2 style={{ fontSize: 'clamp(22px, 4.5vw, 28px)', marginBottom: 6 }}>What do you need help with?</h2>
        <p className="muted" style={{ fontSize: 14.5, marginBottom: 22 }}>
          Add your assignment, project, presentation or journal details, then it goes live on the board.
        </p>

        <form onSubmit={handleSubmit} className="card">
          <div className="field">
            <label>Title</label>
            <input
              value={data.title}
              onChange={update('title')}
              placeholder="e.g. Marketing Research Paper & Presentation Guidance"
              maxLength={150}
              autoFocus
              required
            />
          </div>

          <div className="field">
            <label>Category</label>
            <select value={data.category} onChange={update('category')}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="form-row-2">
            <div className="field" style={{ flex: 1 }}>
              <label>Subject / Topic</label>
              <input value={data.subject} onChange={update('subject')} placeholder="e.g. Business Administration / Data Science" maxLength={80} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Academic Level</label>
              <select value={data.academic_level} onChange={update('academic_level')}>
                {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>

          <div className="field">
            <label>Description & Requirements</label>
            <textarea
              rows={4}
              value={data.description}
              onChange={update('description')}
              placeholder="Provide specific instructions, rubric details, guidelines, or topics you need help with…"
              maxLength={2000}
            />
          </div>

          {/* Document / Assignment Brief Upload Section for Work Provider */}
          <div className="field">
            <label>Attach Assignment / Reference File (Optional)</label>
            <div className="file-upload-box">
              <input
                type="file"
                id="assignment-file-input"
                onChange={handleFileChange}
                accept=".doc,.docx,.pdf,.txt,.rtf,.png,.jpg,.jpeg,.zip,.ppt,.pptx"
                style={{ display: 'none' }}
              />
              
              {!file ? (
                <label htmlFor="assignment-file-input" className="file-upload-label">
                  <div style={{ fontSize: 28, marginBottom: 6 }}>📄</div>
                  <div style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--ink)' }}>
                    Click to browse or upload assignment file
                  </div>
                  <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
                    Supports Word (.docx, .doc), PDF, PPT, Images, ZIP (up to 25MB)
                  </div>
                </label>
              ) : (
                <div className="file-selected-badge">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden', minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: 22, flexShrink: 0 }}>📎</span>
                    <div style={{ overflow: 'hidden', minWidth: 0 }}>
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
                    style={{ color: 'var(--error)', borderColor: 'rgba(217,85,85,0.2)', padding: '4px 10px', flexShrink: 0 }}
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="form-row-2">
            <div className="field" style={{ flex: 1 }}>
              <label>Deadline</label>
              <select value={data.deadline} onChange={update('deadline')}>
                {DEADLINES.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Exact Payment Amount (₹)</label>
              <input 
                type="number" 
                min="100" 
                step="50"
                placeholder="e.g. 1000" 
                value={data.amount} 
                onChange={update('amount')} 
                required
              />
            </div>
          </div>

          <div className="field-hint" style={{ marginBottom: 20 }}>
            💡 Exact amount to be paid after you review and approve the submitted assignment.
          </div>

          <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
            {submitting ? (uploadStatus || 'Posting…') : 'Post Request'}
          </button>
        </form>
      </div>
    </section>
  );
}
