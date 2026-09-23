import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import RequestCard from '../components/RequestCard.jsx';

const CATS = ['All', 'Research', 'Proofreading', 'Formatting', 'Presentation', 'Tutoring', 'Project Support', 'Journal Guidance', 'Assignment Guidance', 'Other'];

export default function Board() {
  const { user, authLoading, requests, claim, toast } = useApp();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('All');
  const [claimingId, setClaimingId] = useState(null);

  if (authLoading) return <div className="wrap" style={{ padding: '60px 0' }}>Loading…</div>;
  if (!user) return <Navigate to="/signup?role=expert" replace />;

  const list = filter === 'All' ? requests : requests.filter((r) => r.category === filter);

  async function handleHelp(id) {
    if (claimingId) return;
    setClaimingId(id);
    try {
      await claim(id);
      toast('Claimed — head to the request to get started');
      navigate(`/request/${id}`);
    } catch (err) {
      toast(err.message || 'Someone may have just claimed this — try another.');
    } finally {
      setClaimingId(null);
    }
  }

  return (
    <section className="wrap" style={{ paddingTop: 48 }}>
      <div className="section-head">
        <h1 style={{ fontSize: 32 }}>Open requests</h1>
        <p className="muted" style={{ fontSize: 14, marginTop: 6 }}>{requests.length} request{requests.length === 1 ? '' : 's'} waiting for help right now.</p>
      </div>
      <div className="chip-row" style={{ marginBottom: 22 }}>
        {CATS.map((c) => <button key={c} className={`chip ${filter === c ? 'selected' : ''}`} onClick={() => setFilter(c)}>{c}</button>)}
      </div>
      <div className="grid grid-3">
        {list.length ? list.map((r) => (
          <div key={r.id}>
            <RequestCard r={r} />
            <button className="btn btn-primary btn-sm btn-block" style={{ marginTop: 10 }}
              disabled={claimingId === r.id} onClick={() => handleHelp(r.id)}>
              {claimingId === r.id ? 'Claiming…' : 'Help With This'}
            </button>
          </div>
        )) : <p className="muted">No open requests in this category right now.</p>}
      </div>
    </section>
  );
}
