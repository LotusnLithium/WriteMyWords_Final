import React from 'react';
import { IconCheckCircle, IconUser } from './Icons.jsx';
import { getBudgetLabel } from '../lib/supabaseClient';

export default function RequestCard({ r }) {
  const subjects = r.subjects || (r.subject ? [r.subject] : []);
  
  const isApprovedPrice = r.price_approved || (r.finalized_price && Number(r.finalized_price) > 0);
  const finalizedAmt = Number(r.finalized_price || r.amount_paid || 0);
  const expertPayout = Number(r.helper_payout_amount || Math.round(finalizedAmt * 0.80));

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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)', fontSize: 13.5, flexWrap: 'wrap', gap: 6 }}>
        <div>
          {isApprovedPrice ? (
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <IconCheckCircle size={14} color="var(--success)" /> ₹{expertPayout} <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-soft)' }}>(80% Payout)</span>
              </div>
            </div>
          ) : (
            <div>
              <span style={{ fontWeight: 600, color: 'var(--ink)' }}>
                {getBudgetLabel(r.budget_min ?? r.budgetMin, r.budget_max ?? r.budgetMax)}
              </span>
              <div style={{ fontSize: 11, color: '#b45309', fontWeight: 600, marginTop: 1 }}>
                Price in review by admin
              </div>
            </div>
          )}
        </div>
        <span className="muted" style={{ fontSize: 12.5 }}>📌 Due in {r.deadline}</span>
      </div>
    </div>
  );
}

