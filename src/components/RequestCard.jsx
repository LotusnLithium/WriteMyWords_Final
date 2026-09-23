import React from 'react';

export default function RequestCard({ r }) {
  const subjects = r.subjects || (r.subject ? [r.subject] : []);
  return (
    <div className="card request-card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <span className="badge">{r.category}</span>
        {r.requester_name && (
          <span style={{ fontSize: 12, color: 'rgba(18,20,43,0.65)', fontWeight: 600 }}>
            👤 {r.requester_name}
          </span>
        )}
      </div>
      <h3 style={{ fontSize: 17, marginTop: 12, wordBreak: 'break-word', flexGrow: 1 }}>{r.title}</h3>
      {subjects.length > 0 && (
        <div className="tag-row" style={{ marginTop: 10 }}>
          {subjects.map((s) => <span className="tag" key={s}>{s}</span>)}
        </div>
      )}
      <div className="muted" style={{ fontSize: 13.5, marginTop: 10, lineHeight: 1.4 }}>
        ₹{r.budget_min ?? r.budgetMin}–₹{r.budget_max ?? r.budgetMax} · Deadline: {r.deadline}
      </div>
    </div>
  );
}

