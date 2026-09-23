import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import {
  createRazorpayOrder, fetchMessages, openRazorpayCheckout, sendMessage, subscribeToMessages,
  uploadAttachment,
} from '../lib/supabaseClient';

const STATUS_LABEL = {
  open: 'Open — not yet claimed',
  claimed: 'A helper is working on this',
  delivered: 'Delivered — awaiting your approval',
  approved: 'Approved & paid',
  cancelled: 'Cancelled',
};

export default function RequestDetail() {
  const { id } = useParams();
  const { user, authLoading, myRequests, requests, claim, deliver, refreshMine, toast } = useApp();
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [deliveryDraft, setDeliveryDraft] = useState('');
  const [deliveryFile, setDeliveryFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [busyText, setBusyText] = useState('');

  const request = useMemo(
    () => myRequests.find((r) => r.id === id) || requests.find((r) => r.id === id),
    [myRequests, requests, id],
  );
  const isParticipant = request && (request.user_id === user?.id || request.helper_id === user?.id);

  useEffect(() => {
    if (!isParticipant) return;
    fetchMessages(id).then(setMessages);
    const unsubscribe = subscribeToMessages(id, (m) => setMessages((prev) => [...prev, m]));
    return unsubscribe;
  }, [id, isParticipant]);

  if (authLoading) return <div className="wrap" style={{ padding: '60px 0' }}>Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!request) return <div className="wrap" style={{ padding: '60px 0' }}><div className="empty"><h3>Request not found.</h3></div></div>;

  const isOwner = request.user_id === user.id;
  const isHelper = request.helper_id === user.id;

  function formatBytes(bytes) {
    if (!bytes) return '';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function handleDeliveryFileChange(e) {
    const selected = e.target.files?.[0];
    if (selected) {
      if (selected.size > 25 * 1024 * 1024) {
        toast('File is too large. Please select a file under 25MB.');
        return;
      }
      setDeliveryFile(selected);
    }
  }

  async function handleClaim() {
    setBusy(true);
    try {
      await claim(id);
      toast('Claimed — say hello in messages below!');
    } catch (err) {
      toast(err.message || 'Could not claim this request.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!draft.trim() || busy) return;
    setBusy(true);
    try {
      const msg = await sendMessage(id, user.id, draft.trim());
      if (msg) setMessages((prev) => [...prev, msg]);
      setDraft('');
    } catch {
      toast('Message could not be sent.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDeliver() {
    if (!deliveryDraft.trim() && !deliveryFile) {
      toast('Please write your guidance text or attach a Word document.');
      return;
    }
    if (busy) return;

    setBusy(true);
    setBusyText(deliveryFile ? 'Uploading Word document…' : 'Submitting delivery…');

    try {
      let fileUrl = null;
      let fileName = null;

      if (deliveryFile) {
        try {
          const uploaded = await uploadAttachment(deliveryFile, 'deliveries');
          if (uploaded) {
            fileUrl = uploaded.url;
            fileName = uploaded.name;
          }
        } catch (uploadErr) {
          console.warn('Delivery file upload note:', uploadErr);
          fileName = deliveryFile.name;
        }
      }

      setBusyText('Finalizing deliverable…');
      await deliver(id, {
        deliveryText: deliveryDraft.trim(),
        deliveryFileUrl: fileUrl,
        deliveryFileName: fileName,
      });

      toast('Delivered! The student can now review and approve your work.');
      setDeliveryFile(null);
      setDeliveryDraft('');
    } catch (err) {
      console.error('Delivery submission error:', err);
      toast('Could not submit delivery — please try again.');
    } finally {
      setBusy(false);
      setBusyText('');
    }
  }

  async function handleApproveAndPay() {
    setBusy(true);
    try {
      const order = await createRazorpayOrder(id);
      openRazorpayCheckout({
        order,
        request,
        onSuccess: async () => {
          toast('Payment confirmed — approved!');
          await refreshMine();
        },
        onError: (err) => toast(err.message || 'Payment did not complete.'),
      });
    } catch (err) {
      toast(err.message || 'Could not start payment.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="wrap" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span className="badge">{request.category}</span>
          {request.requester_name && (
            <span style={{ fontSize: 13, color: 'rgba(18,20,43,0.7)', fontWeight: 600 }}>
              👤 Requested by: {request.requester_name}
            </span>
          )}
        </div>
        <h1 style={{ fontSize: 26, marginTop: 12 }}>{request.title}</h1>
        <div className="tag-row" style={{ marginTop: 10 }}>
          <span className="tag">{request.subject || 'General'}</span>
          <span className="tag">{request.academic_level}</span>
        </div>

        <p className="muted" style={{ marginTop: 14, fontSize: 15, lineHeight: 1.6 }}>
          {request.description || 'No description added.'}
        </p>

        {/* Work Provider's Attached Document */}
        {(request.attachment_url || request.attachment_name) && (
          <div className="document-attachment-card" style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 24 }}>📎</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Student Attached Document
                </div>
                <div style={{ fontWeight: 600, fontSize: 14.5, marginTop: 2 }}>
                  {request.attachment_name || 'Assignment Brief'}
                </div>
              </div>
            </div>
            {request.attachment_url ? (
              <a
                href={request.attachment_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost btn-sm"
                download
              >
                Download / View
              </a>
            ) : (
              <span className="badge" style={{ fontSize: 11 }}>Attached</span>
            )}
          </div>
        )}

        <div className="card" style={{ marginTop: 18 }}>
          <div className="muted" style={{ fontSize: 14 }}>
            Budget: <strong style={{ color: 'var(--ink)' }}>₹{request.budget_min}–₹{request.budget_max}</strong>
          </div>
          <div className="muted" style={{ fontSize: 14, marginTop: 6 }}>
            Deadline: <strong style={{ color: 'var(--ink)' }}>{request.deadline}</strong>
          </div>
          {request.helper_name && (
            <div className="muted" style={{ fontSize: 14, marginTop: 6 }}>
              Assigned Helper: <strong style={{ color: 'var(--blue)' }}>🤝 {request.helper_name}</strong>
            </div>
          )}
          {isParticipant && (
            <div className="muted" style={{ fontSize: 14, marginTop: 6 }}>
              Status: <strong style={{ color: 'var(--ink)' }}>{STATUS_LABEL[request.status] || request.status}</strong>
            </div>
          )}
        </div>

        {!isParticipant && (
          <button className="btn btn-primary" style={{ marginTop: 20 }} disabled={busy} onClick={handleClaim}>
            {busy ? 'Claiming…' : 'Help With This'}
          </button>
        )}

        {isParticipant && (
          <>
            {/* Helper Submission Form (when claimed) */}
            {isHelper && request.status === 'claimed' && (
              <div className="card" style={{ marginTop: 22, border: '1.5px solid var(--blue)' }}>
                <h3 style={{ fontSize: 17, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>✍️</span> Submit your Guidance & Word Document
                </h3>
                <p className="muted" style={{ fontSize: 13.5, marginTop: 4 }}>
                  Provide feedback, explanation, or upload your edited/annotated Word document (.docx/.doc).
                </p>

                <textarea
                  rows={4}
                  style={{
                    width: '100%',
                    marginTop: 14,
                    padding: 12,
                    borderRadius: 10,
                    border: '1px solid var(--border-strong)',
                    fontFamily: 'inherit',
                    fontSize: 14,
                  }}
                  value={deliveryDraft}
                  onChange={(e) => setDeliveryDraft(e.target.value)}
                  placeholder="Write your explanation, summary of feedback, or notes here…"
                  maxLength={4000}
                />

                {/* Word Document Upload Section for Helper */}
                <div style={{ marginTop: 14 }}>
                  <label style={{ display: 'block', fontSize: 13.5, fontWeight: 600, marginBottom: 6 }}>
                    Upload Word Document / Solution File (Optional)
                  </label>
                  <input
                    type="file"
                    id="delivery-file-input"
                    onChange={handleDeliveryFileChange}
                    accept=".doc,.docx,.pdf,.txt,.rtf,.zip"
                    style={{ display: 'none' }}
                  />

                  {!deliveryFile ? (
                    <label htmlFor="delivery-file-input" className="file-upload-label" style={{ padding: '16px' }}>
                      <div style={{ fontSize: 24, marginBottom: 4 }}>📄</div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>
                        Click to upload Word Document (.docx, .doc, .pdf)
                      </div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        Attach your completed guidance document (up to 25MB)
                      </div>
                    </label>
                  ) : (
                    <div className="file-selected-badge">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 22 }}>📘</span>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{deliveryFile.name}</div>
                          <div className="muted" style={{ fontSize: 12 }}>{formatBytes(deliveryFile.size)}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDeliveryFile(null)}
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--error)', padding: '4px 10px' }}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>

                <button
                  className="btn btn-primary"
                  style={{ marginTop: 16 }}
                  disabled={busy}
                  onClick={handleDeliver}
                >
                  {busy ? (busyText || 'Submitting…') : 'Submit Delivery'}
                </button>
              </div>
            )}

            {/* Delivered State */}
            {request.status === 'delivered' && (
              <div className="card" style={{ marginTop: 22, background: 'rgba(49, 87, 213, 0.03)', borderColor: 'var(--blue)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <h3 style={{ fontSize: 17 }}>Delivered Guidance</h3>
                  <span className="badge badge-warn">Awaiting Approval</span>
                </div>

                {request.delivery_text && (
                  <p style={{ fontSize: 14.5, marginTop: 8, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                    {request.delivery_text}
                  </p>
                )}

                {/* Delivered Word Document */}
                {(request.delivery_file_url || request.delivery_file_name) && (
                  <div className="document-attachment-card" style={{ marginTop: 14, background: '#fff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 26 }}>📘</span>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--blue)', textTransform: 'uppercase' }}>
                          Delivered Word Document
                        </div>
                        <div style={{ fontWeight: 600, fontSize: 14.5, marginTop: 2 }}>
                          {request.delivery_file_name || 'Completed Guidance Document.docx'}
                        </div>
                      </div>
                    </div>
                    {request.delivery_file_url && (
                      <a
                        href={request.delivery_file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-primary btn-sm"
                        download
                      >
                        Download Word Doc
                      </a>
                    )}
                  </div>
                )}

                {isOwner && (
                  <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                    <p style={{ fontSize: 13.5, color: 'rgba(18,20,43,0.7)', marginBottom: 12 }}>
                      Review the guidance and document above. Once satisfied, click below to approve and pay the helper.
                    </p>
                    <button className="btn btn-primary" disabled={busy} onClick={handleApproveAndPay}>
                      {busy ? 'Opening Razorpay…' : `Approve & Pay ₹${request.budget_max}`}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Approved State */}
            {request.status === 'approved' && (
              <div className="card" style={{ marginTop: 22, background: 'rgba(47, 143, 104, 0.04)', borderColor: 'var(--success)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <h3 style={{ fontSize: 17 }}>Delivered Guidance (Completed)</h3>
                  <span className="badge badge-success">✓ Paid & Approved</span>
                </div>

                {request.delivery_text && (
                  <p style={{ fontSize: 14.5, marginTop: 8, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                    {request.delivery_text}
                  </p>
                )}

                {/* Delivered Word Document */}
                {(request.delivery_file_url || request.delivery_file_name) && (
                  <div className="document-attachment-card" style={{ marginTop: 14, background: '#fff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 26 }}>📘</span>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--success)', textTransform: 'uppercase' }}>
                          Attached Document
                        </div>
                        <div style={{ fontWeight: 600, fontSize: 14.5, marginTop: 2 }}>
                          {request.delivery_file_name || 'Completed Guidance Document.docx'}
                        </div>
                      </div>
                    </div>
                    {request.delivery_file_url && (
                      <a
                        href={request.delivery_file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-primary btn-sm"
                        download
                      >
                        Download Word Doc
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Messages Thread */}
            <div className="card" style={{ marginTop: 22 }}>
              <h3 style={{ fontSize: 16, marginBottom: 12 }}>Messages</h3>
              <div style={{ maxHeight: 280, overflowY: 'auto', marginBottom: 12 }}>
                {messages.length ? (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        maxWidth: '78%',
                        padding: '10px 14px',
                        borderRadius: 14,
                        fontSize: 14,
                        marginBottom: 8,
                        marginLeft: m.sender_id === user.id ? 'auto' : 0,
                        background: m.sender_id === user.id ? 'var(--ink)' : 'var(--soft-blue)',
                        color: m.sender_id === user.id ? '#fff' : 'var(--ink)',
                      }}
                    >
                      {m.body}
                    </div>
                  ))
                ) : (
                  <p className="muted" style={{ fontSize: 13.5 }}>No messages yet — say hello.</p>
                )}
              </div>
              <form onSubmit={handleSend} style={{ display: 'flex', gap: 8 }}>
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Write a message…"
                  maxLength={2000}
                  style={{
                    flex: 1,
                    padding: '11px 14px',
                    borderRadius: 10,
                    border: '1px solid var(--border-strong)',
                    fontFamily: 'inherit',
                  }}
                />
                <button className="btn btn-primary btn-sm" type="submit" disabled={busy}>
                  Send
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
