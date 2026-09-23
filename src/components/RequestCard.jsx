import React from 'react';
import { IconUser } from './Icons.jsx';

export default function RequestCard({ r }) {
  const subjects = r.subjects || (r.subject ? [r.subject] : []);
  return (
    <div className="card request-card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <span className="badge">{r.category}</span>
        {r.requester_name && (
          <span style={{ fontSize: 12, color: 'rgba(18,20,43,0.65)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <IconUser size={13} color="rgba(18,20,43,0.5)" /> {r.requester_name}
          </span>
        )}
      </div>
      <h3 style={{ fontSize: 17, marginTop: 12, wordBreak: 'break-word', flexGrow: 1 }}>{r.title}</h3>
      {subjects.length > 0 && (
        <div className="tag-row" style={{ marginTop: 10 }}>
          {subjects.map((s) => <span className="tag" key={s}>{s}</span>)}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)', fontSize: 13.5 }}>
        <span style={{ fontWeight: 600, color: 'var(--ink)' }}>
          { (r.budget_max && r.budget_min && r.budget_max === r.budget_min) || (r.budget_max && !r.budget_min) || (!r.budget_max && r.budget_min)
            ? `₹${r.budget_max || r.budget_min}`
            : `₹${r.budget_min ?? r.budgetMin ?? 0}–₹${r.budget_max ?? r.budgetMax ?? 0}`
          }
        </span>
        <span className="muted" style={{ fontSize: 12.5 }}>Due in {r.deadline}</span>
      </div>
    </div>
  );
}

