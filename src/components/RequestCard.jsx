import React from 'react';

export default function RequestCard({ r }) {
  const subjects = r.subjects || (r.subject ? [r.subject] : []);
  return (
    <div className="card">
      <span className="badge">{r.category}</span>
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
