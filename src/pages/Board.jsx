import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import RequestCard from '../components/RequestCard.jsx';

const CATS = ['All', 'Assignment Guidance', 'Project Support', 'Presentation', 'Journal Guidance', 'Research', 'Proofreading', 'Formatting', 'Tutoring', 'Other'];

export default function Board() {
  const { user, authLoading, requests, claim, toast } = useApp();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('All');
  const [claimingId, setClaimingId] = useState(null);

  if (authLoading) return <div className="wrap" style={{ padding: '60px 0', textAlign: 'center' }}>Loading…</div>;
  if (!user) return <Navigate to="/signup?role=expert" replace />;

  const list = filter === 'All' ? requests : requests.filter((r) => r.category === filter);

  async function handleHelp(e, id) {
    e.stopPropagation();
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
    <section className="wrap" style={{ paddingTop: 'clamp(24px, 5vw, 48px)', paddingBottom: 'clamp(32px, 5vw, 60px)' }}>
      <div className="section-head">
        <h1 style={{ fontSize: 'clamp(26px, 5vw, 34px)' }}>Open requests</h1>
        <p className="muted" style={{ fontSize: 14.5, marginTop: 6 }}>
          {requests.length} request{requests.length === 1 ? '' : 's'} waiting for help right now.
        </p>
      </div>

      <div className="chip-row" style={{ marginBottom: 24 }}>
        {CATS.map((c) => (
          <button
            key={c}
            className={`chip ${filter === c ? 'selected' : ''}`}
            onClick={() => setFilter(c)}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid grid-3">
        {list.length ? list.map((r) => (
          <div
            key={r.id}
            className="board-card-wrapper"
            style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
          >
            <Link to={`/request/${r.id}`} style={{ flex: 1, display: 'block' }}>
              <RequestCard r={r} />
            </Link>
            <button
              className="btn btn-primary btn-sm btn-block"
              style={{ marginTop: 10 }}
              disabled={claimingId === r.id}
              onClick={(e) => handleHelp(e, r.id)}
            >
              {claimingId === r.id ? 'Claiming…' : 'Help With This'}
            </button>
          </div>
        )) : (
          <div className="empty" style={{ gridColumn: '1 / -1' }}>
            <h3>No open requests in this category</h3>
            <p className="muted" style={{ marginTop: 6, fontSize: 14 }}>Try selecting "All" or browse other categories.</p>
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 14 }} onClick={() => setFilter('All')}>
              Show All Requests
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

