import React from 'react';

export default function RequestCard({ r }) {
  const subjects = r.subjects || (r.subject ? [r.subject] : []);
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <span className="badge">{r.category}</span>
        {r.requester_name && (
          <span style={{ fontSize: 12, color: 'rgba(18,20,43,0.6)', fontWeight: 500 }}>
            👤 {r.requester_name}
          </span>
        )}
      </div>
      <h3 style={{ fontSize: 17, marginTop: 12 }}>{r.title}</h3>
      <div className="tag-row" style={{ marginTop: 8 }}>
        {subjects.map((s) => <span className="tag" key={s}>{s}</span>)}
      </div>
      <div className="muted" style={{ fontSize: 13.5, marginTop: 8 }}>
        ₹{r.budget_min ?? r.budgetMin}–₹{r.budget_max ?? r.budgetMax} · Deadline: {r.deadline}
      </div>
    </div>
  );
}
