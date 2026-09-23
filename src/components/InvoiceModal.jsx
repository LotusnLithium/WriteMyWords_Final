import React from 'react';

export default function InvoiceModal({ request, user, onClose }) {
  if (!request) return null;

  const invoiceNumber = `INV-${(request.id || '00000000').slice(0, 8).toUpperCase()}`;
  const invoiceDate = request.paid_at
    ? new Date(request.paid_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
  const amount = request.amount_paid || request.budget_max || request.budget_min || 0;

  function handlePrint() {
    window.print();
  }

  return (
    <div className="invoice-overlay" onClick={onClose}>
      <div className="invoice-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="invoice-actions-bar no-print">
          <div style={{ fontWeight: 600, fontSize: 16 }}>Tax Invoice & Receipt</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-primary btn-sm" onClick={handlePrint}>
              🖨️ Print / Save PDF
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>
              ✕ Close
            </button>
          </div>
        </div>

        <div className="invoice-printable-content" id="printable-invoice">
          {/* Header */}
          <div className="invoice-header">
            <div>
              <div className="invoice-logo">WriteMyWords</div>
              <div className="invoice-subtext">Academic Guidance & Project Support Platform</div>
              <div className="invoice-subtext">support@writemywords.com</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="invoice-badge-paid">PAID & SETTLED</div>
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 8 }}>{invoiceNumber}</div>
              <div className="invoice-subtext">Date: {invoiceDate}</div>
            </div>
          </div>

          <hr className="invoice-divider" />

          {/* Party Details */}
          <div className="invoice-parties-grid">
            <div className="invoice-party-col">
              <div className="invoice-party-title">BILLED TO (STUDENT)</div>
              <div style={{ fontWeight: 600, fontSize: 15, marginTop: 4 }}>
                {request.requester_name || (user?.role === 'student' ? user.name : 'Student')}
              </div>
              <div className="invoice-subtext">Service: Academic Assignment Guidance</div>
              <div className="invoice-subtext">Payment Mode: Online (Razorpay Gateway)</div>
            </div>
            <div className="invoice-party-col">
              <div className="invoice-party-title">ASSIGNED EXPERT (HELPER)</div>
              <div style={{ fontWeight: 600, fontSize: 15, marginTop: 4 }}>
                {request.helper_name || (user?.role === 'expert' ? user.name : 'Verified Expert')}
              </div>
              <div className="invoice-subtext">Deliverable: Solution Document & Guidance</div>
              <div className="invoice-subtext">Payout Status: Scheduled within 24–48h</div>
            </div>
          </div>

          {/* Itemized Table */}
          <table className="invoice-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Category</th>
                <th>Academic Level</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>{request.title}</strong>
                  {request.delivery_file_name && (
                    <div style={{ fontSize: 12, color: 'var(--blue)', marginTop: 4 }}>
                      📎 Deliverable: {request.delivery_file_name}
                    </div>
                  )}
                </td>
                <td>{request.category}</td>
                <td>{request.academic_level}</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>₹{amount}</td>
              </tr>
            </tbody>
          </table>

          {/* Total Box */}
          <div className="invoice-total-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span className="invoice-subtext">Subtotal</span>
              <span>₹{amount}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span className="invoice-subtext">Taxes & Platform Processing</span>
              <span>₹0.00 (Inclusive)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1.5px solid var(--border)', paddingTop: 8, fontSize: 16, fontWeight: 700 }}>
              <span>Total Paid Amount</span>
              <span style={{ color: 'var(--success)' }}>₹{amount}</span>
            </div>
          </div>

          {/* Payment metadata */}
          <div className="invoice-footer-notes">
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Transaction & Gateway Reference:</div>
            <div>Payment ID: <code>{request.razorpay_payment_id || 'RZP-PAID-' + (request.id || '').slice(0, 10)}</code></div>
            <div>Order ID: <code>{request.razorpay_order_id || 'ORDER-' + (request.id || '').slice(0, 10)}</code></div>
            <div style={{ marginTop: 8, fontStyle: 'italic' }}>
              * Helper payout notice: The expert payout is processed within 24 to 48 hours after final student approval.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
