import React, { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { supabase } from '../lib/supabaseClient';
import RequestCard from '../components/RequestCard.jsx';

const STATUS_MAP = {
  open: { label: 'Open', cls: '' },
  claimed: { label: 'In Progress', cls: 'badge-blue' },
  delivered: { label: 'Delivered — Awaiting Approval', cls: 'badge-warn' },
  approved: { label: 'Approved & Paid', cls: 'badge-success' },
  cancelled: { label: 'Cancelled', cls: '' },
};

export default function Dashboard() {
  const { user, authLoading, myRequests, toast } = useApp();
  const [switching, setSwitching] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'posted', 'helping'

  if (authLoading) return <div className="wrap" style={{ padding: '60px 0', textAlign: 'center' }}>Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;

  const posted = myRequests.filter((r) => r.user_id === user.id);
  const helping = myRequests.filter((r) => r.helper_id === user.id);
  const completedHelping = helping.filter((r) => r.status === 'approved');

  async function switchRole() {
    if (!supabase || switching) return;
    setSwitching(true);
    const nextRole = user.role === 'expert' ? 'student' : 'expert';
    const { error } = await supabase.from('profiles').update({ role: nextRole }).eq('id', user.id);
    setSwitching(false);
    if (error) { toast('Could not switch roles.'); return; }
    toast(`Switched — you're now set up as ${nextRole === 'expert' ? 'a helper' : 'a poster'}.`);
    window.location.reload();
  }

  return (
    <section className="wrap" style={{ paddingTop: 'clamp(24px, 4.5vw, 40px)', paddingBottom: 'clamp(32px, 5vw, 60px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 'clamp(22px, 4.5vw, 28px)', fontWeight: 700 }}>Welcome back, {user.name?.split(' ')[0]}</h1>
          <p className="muted" style={{ fontSize: 14.5, marginTop: 4 }}>
            Manage your assignments, projects, presentations, and active collaborations.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', width: '100%', maxWidth: 'max-content' }}>
          <Link to="/post" className="btn btn-primary btn-sm">
            + Post a Request
          </Link>
          <Link to="/board" className="btn btn-ghost btn-sm">
            Browse Board
          </Link>
        </div>
      </div>

      {/* Helper Payout Alert on Dashboard if any approved projects */}
      {completedHelping.length > 0 && (
        <div style={{ marginBottom: 24, padding: '14px 18px', background: '#ecfdf5', borderRadius: 12, border: '1px solid #a7f3d0' }}>
          <div style={{ fontWeight: 600, color: '#065f46', fontSize: 14.5, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>📞</span> <strong>Helper Payout Notice:</strong>
          </div>
          <p style={{ color: '#047857', fontSize: 13.5, marginTop: 4, lineHeight: 1.5, marginBottom: 0 }}>
            We will call you within 24 to 48 hours, after approval of your submitted assignment for payment.
          </p>
        </div>
      )}

      <div className="metric-row" style={{ marginBottom: 28 }}>
        <div className="metric">
          <div className="num">{posted.length}</div>
          <div className="lbl">Posted Requests</div>
        </div>
        <div className="metric">
          <div className="num">{helping.length}</div>
          <div className="lbl">Helping With</div>
        </div>
        <div className="metric">
          <div className="num">{myRequests.filter((r) => r.status === 'approved').length}</div>
          <div className="lbl">Completed</div>
        </div>
        <div className="metric">
          <div className="num">
            ₹{myRequests.filter((r) => r.status === 'approved' && r.helper_id === user.id).reduce((s, r) => s + Number(r.amount_paid || r.budget_max || r.budget_min || 0), 0)}
          </div>
          <div className="lbl">Earned (₹)</div>
        </div>
      </div>

      {/* Filter Tabs for Mobile & Desktop */}
      <div className="chip-row" style={{ marginBottom: 24 }}>
        <button className={`chip ${activeTab === 'all' ? 'selected' : ''}`} onClick={() => setActiveTab('all')}>
          All Activity ({myRequests.length})
        </button>
        <button className={`chip ${activeTab === 'posted' ? 'selected' : ''}`} onClick={() => setActiveTab('posted')}>
          My Posts ({posted.length})
        </button>
        <button className={`chip ${activeTab === 'helping' ? 'selected' : ''}`} onClick={() => setActiveTab('helping')}>
          Helping Projects ({helping.length})
        </button>
      </div>

      {(activeTab === 'all' || activeTab === 'posted') && (
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h2 style={{ fontSize: 19, fontWeight: 600 }}>What you posted ({posted.length})</h2>
            <Link to="/post" className="muted" style={{ fontSize: 13, fontWeight: 600, color: 'var(--blue)' }}>+ New Request</Link>
          </div>
          {posted.length ? (
            <div className="grid grid-3">
              {posted.map((r) => (
                <Link to={`/request/${r.id}`} key={r.id} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <RequestCard r={r} />
                  <div style={{ marginTop: 8 }}>
                    <span className={`badge ${STATUS_MAP[r.status]?.cls || ''}`}>
                      {STATUS_MAP[r.status]?.label || r.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty">
              <h3 style={{ fontSize: 17 }}>No posted requests</h3>
              <p className="muted" style={{ fontSize: 14, marginTop: 4, marginBottom: 14 }}>
                Post an assignment, presentation, project or journal to get expert guidance.
              </p>
              <Link to="/post" className="btn btn-primary btn-sm">Post a Request</Link>
            </div>
          )}
        </div>
      )}

      {(activeTab === 'all' || activeTab === 'helping') && (
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h2 style={{ fontSize: 19, fontWeight: 600 }}>What you're helping with ({helping.length})</h2>
            <Link to="/board" className="muted" style={{ fontSize: 13, fontWeight: 600, color: 'var(--blue)' }}>Browse Board →</Link>
          </div>
          {helping.length ? (
            <div className="grid grid-3">
              {helping.map((r) => (
                <Link to={`/request/${r.id}`} key={r.id} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <RequestCard r={r} />
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className={`badge ${STATUS_MAP[r.status]?.cls || ''}`}>
                      {STATUS_MAP[r.status]?.label || r.status}
                    </span>
                    {r.status === 'approved' && (
                      <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>
                        ✓ Call within 24-48h for payment
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty">
              <h3 style={{ fontSize: 17 }}>Not helping with any requests yet</h3>
              <p className="muted" style={{ fontSize: 14, marginTop: 4, marginBottom: 14 }}>
                Browse the board to claim requests and earn money assisting students.
              </p>
              <Link to="/board" className="btn btn-primary btn-sm">Browse Open Requests</Link>
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
        <button className="btn btn-ghost btn-sm" onClick={switchRole} disabled={switching}>
          {switching ? 'Switching…' : `Switch to ${user.role === 'expert' ? 'posting requests' : 'helping others'}`}
        </button>
      </div>
    </section>
  );
}

