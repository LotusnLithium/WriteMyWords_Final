import React, { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { supabase } from '../lib/supabaseClient';
import RequestCard from '../components/RequestCard.jsx';

export default function Dashboard() {
  const { user, authLoading, myRequests, toast } = useApp();
  const [switching, setSwitching] = useState(false);

  if (authLoading) return <div className="wrap" style={{ padding: '60px 0', textAlign: 'center' }}>Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;

  const posted = myRequests.filter((r) => r.user_id === user.id);
  const helping = myRequests.filter((r) => r.helper_id === user.id);

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 'clamp(22px, 4.5vw, 28px)' }}>Welcome back, {user.name?.split(' ')[0]}</h2>
          <p className="muted" style={{ fontSize: 14.5, marginTop: 4 }}>
            Everything you've posted and everything you're helping with, in one place.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', width: '100%', maxWidth: 'max-content' }}>
          <Link to="/post" className="btn btn-primary btn-sm">
            + Post a Request
          </Link>
          <Link to="/board" className="btn btn-ghost btn-sm">
            Find Requests
          </Link>
        </div>
      </div>

      <div className="metric-row">
        <div className="metric">
          <div className="num">{posted.length}</div>
          <div className="lbl">Posted</div>
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
            ₹{myRequests.filter((r) => r.status === 'approved' && r.helper_id === user.id).reduce((s, r) => s + Number(r.amount_paid || 0), 0)}
          </div>
          <div className="lbl">Earned</div>
        </div>
      </div>

      <h3 style={{ fontSize: 19, marginBottom: 14 }}>What you posted</h3>
      {posted.length ? (
        <div className="grid grid-3" style={{ marginBottom: 36 }}>
          {posted.map((r) => (
            <Link to={`/request/${r.id}`} key={r.id} style={{ display: 'block' }}>
              <RequestCard r={r} />
              <span className="badge" style={{ marginTop: 8 }}>{r.status}</span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty" style={{ marginBottom: 36 }}>
          <h3 style={{ fontSize: 18 }}>Nothing posted yet</h3>
          <p className="muted" style={{ fontSize: 14, marginTop: 4, marginBottom: 16 }}>
            Your next request could be the start of something useful.
          </p>
          <Link to="/post" className="btn btn-primary btn-sm">Post a Request</Link>
        </div>
      )}

      <h3 style={{ fontSize: 19, marginBottom: 14 }}>What you're helping with</h3>
      {helping.length ? (
        <div className="grid grid-3" style={{ marginBottom: 36 }}>
          {helping.map((r) => (
            <Link to={`/request/${r.id}`} key={r.id} style={{ display: 'block' }}>
              <RequestCard r={r} />
              <span className="badge" style={{ marginTop: 8 }}>{r.status}</span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty" style={{ marginBottom: 36 }}>
          <h3 style={{ fontSize: 18 }}>Not helping with anything yet</h3>
          <p className="muted" style={{ fontSize: 14, marginTop: 4, marginBottom: 16 }}>
            Browse the board to find a request that fits your skills.
          </p>
          <Link to="/board" className="btn btn-primary btn-sm">Find Requests</Link>
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

