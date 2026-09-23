import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import {
  createRazorpayOrder, fetchMessages, openRazorpayCheckout, sendMessage, subscribeToMessages,
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
  const [busy, setBusy] = useState(false);

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
  const isOpenForClaim = !isParticipant && request.status === undefined; // rows from the public board have no status field (implicitly open)

  async function handleClaim() {
    setBusy(true);
    try { await claim(id); toast('Claimed — say hello below'); }
    catch (err) { toast(err.message || 'Could not claim this request.'); }
    finally { setBusy(false); }
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!draft.trim() || busy) return;
    setBusy(true);
    try {
      const msg = await sendMessage(id, user.id, draft.trim());
      if (msg) setMessages((prev) => [...prev, msg]);
      setDraft('');
    } catch { toast('Message could not be sent.'); }
    finally { setBusy(false); }
  }

  async function handleDeliver() {
    if (!deliveryDraft.trim() || busy) return;
    setBusy(true);
    try { await deliver(id, deliveryDraft.trim()); toast('Delivered — the student can now review and approve.'); }
    catch { toast('Could not submit delivery.'); }
    finally { setBusy(false); }
  }

  async function handleApproveAndPay() {
    setBusy(true);
    try {
      const order = await createRazorpayOrder(id);
      openRazorpayCheckout({
        order, request,
        onSuccess: async () => { toast('Payment confirmed — approved!'); await refreshMine(); },
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
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <span className="badge">{request.category}</span>
        <h1 style={{ fontSize: 26, marginTop: 12 }}>{request.title}</h1>
        <div className="tag-row" style={{ marginTop: 10 }}>
          <span className="tag">{request.subject || 'General'}</span>
          <span className="tag">{request.academic_level}</span>
        </div>
        <p className="muted" style={{ marginTop: 14 }}>{request.description || 'No description added.'}</p>
        <div className="card" style={{ marginTop: 18 }}>
          <div className="muted" style={{ fontSize: 14 }}>Budget: <strong style={{ color: 'var(--ink)' }}>₹{request.budget_min}–₹{request.budget_max}</strong></div>
          <div className="muted" style={{ fontSize: 14, marginTop: 6 }}>Deadline: <strong style={{ color: 'var(--ink)' }}>{request.deadline}</strong></div>
          {isParticipant && (
            <div className="muted" style={{ fontSize: 14, marginTop: 6 }}>Status: <strong style={{ color: 'var(--ink)' }}>{STATUS_LABEL[request.status] || request.status}</strong></div>
          )}
        </div>

        {!isParticipant && (
          <button className="btn btn-primary" style={{ marginTop: 20 }} disabled={busy} onClick={handleClaim}>
            {busy ? 'Claiming…' : 'Help With This'}
          </button>
        )}

        {isParticipant && (
          <>
            {isHelper && request.status === 'claimed' && (
              <div className="card" style={{ marginTop: 22 }}>
                <h3 style={{ fontSize: 16 }}>Submit your guidance</h3>
                <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>Feedback, explanation, an edited excerpt with comments — not a finished assignment to submit as the student's own.</p>
                <textarea rows={5} style={{ width: '100%', marginTop: 12, padding: 12, borderRadius: 10, border: '1px solid var(--border-strong)', fontFamily: 'inherit' }}
                  value={deliveryDraft} onChange={(e) => setDeliveryDraft(e.target.value)} placeholder="Write your guidance here…" maxLength={4000} />
                <button className="btn btn-primary" style={{ marginTop: 10 }} disabled={busy} onClick={handleDeliver}>
                  {busy ? 'Submitting…' : 'Submit Delivery'}
                </button>
              </div>
            )}

            {request.status === 'delivered' && (
              <div className="card" style={{ marginTop: 22 }}>
                <h3 style={{ fontSize: 16 }}>Delivered guidance</h3>
                <p style={{ fontSize: 14.5, marginTop: 8, whiteSpace: 'pre-wrap' }}>{request.delivery_text}</p>
                {isOwner && (
                  <button className="btn btn-primary" style={{ marginTop: 14 }} disabled={busy} onClick={handleApproveAndPay}>
                    {busy ? 'Opening payment…' : `Approve & Pay ₹${request.budget_max}`}
                  </button>
                )}
              </div>
            )}

            {request.status === 'approved' && (
              <div className="card" style={{ marginTop: 22 }}>
                <span className="badge badge-success">Paid</span>
                <p style={{ fontSize: 14.5, marginTop: 10, whiteSpace: 'pre-wrap' }}>{request.delivery_text}</p>
              </div>
            )}

            <div className="card" style={{ marginTop: 22 }}>
              <h3 style={{ fontSize: 16, marginBottom: 12 }}>Messages</h3>
              <div style={{ maxHeight: 280, overflowY: 'auto', marginBottom: 12 }}>
                {messages.length ? messages.map((m) => (
                  <div key={m.id} style={{
                    maxWidth: '78%', padding: '10px 14px', borderRadius: 14, fontSize: 14, marginBottom: 8,
                    marginLeft: m.sender_id === user.id ? 'auto' : 0,
                    background: m.sender_id === user.id ? 'var(--ink)' : 'var(--soft-blue)',
                    color: m.sender_id === user.id ? '#fff' : 'var(--ink)',
                  }}>{m.body}</div>
                )) : <p className="muted" style={{ fontSize: 13.5 }}>No messages yet — say hello.</p>}
              </div>
              <form onSubmit={handleSend} style={{ display: 'flex', gap: 8 }}>
                <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Write a message…" maxLength={2000}
                  style={{ flex: 1, padding: '11px 14px', borderRadius: 10, border: '1px solid var(--border-strong)', fontFamily: 'inherit' }} />
                <button className="btn btn-primary btn-sm" type="submit" disabled={busy}>Send</button>
              </form>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
