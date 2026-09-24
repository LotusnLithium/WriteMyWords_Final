import React, { useState } from 'react';
import { IconCheckCircle, IconClose, IconPaperclip, IconPhone, IconPrinter, IconShield, IconUser } from './Icons.jsx';

export default function InvoiceModal({ request, user, onClose }) {
  if (!request) return null;

  const isUserExpert = user?.role === 'expert' || request.helper_id === user?.id;
  const [docType, setDocType] = useState(isUserExpert ? 'expert_voucher' : 'student_invoice'); // 'student_invoice' | 'expert_voucher'

  const invoiceNumber = `INV-${(request.id || '00000000').slice(0, 8).toUpperCase()}`;
  const voucherNumber = `VCH-${(request.id || '00000000').slice(0, 8).toUpperCase()}`;
  
  const invoiceDate = request.paid_at
    ? new Date(request.paid_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });

  const grossAmount = Number(request.finalized_price || request.amount_paid || request.budget_max || request.budget_min || 0);
  const platformFee = Number(request.platform_fee_amount || Math.round(grossAmount * 0.20));
  const helperPayout = Number(request.helper_payout_amount || (grossAmount - platformFee));

  function handlePrint() {
    window.print();
  }

  return (
    <div className="invoice-overlay" onClick={onClose}>
      <div className="invoice-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Actions bar */}
        <div className="invoice-actions-bar no-print">
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              className={`chip ${docType === 'student_invoice' ? 'selected' : ''}`}
              onClick={() => setDocType('student_invoice')}
              style={{ fontSize: 13, fontWeight: 600 }}
            >
              Student Tax Invoice
            </button>
            <button
              type="button"
              className={`chip ${docType === 'expert_voucher' ? 'selected' : ''}`}
              onClick={() => setDocType('expert_voucher')}
              style={{ fontSize: 13, fontWeight: 600 }}
            >
              Expert 80% Payout Voucher
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={handlePrint} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <IconPrinter size={15} color="#fff" /> Print / Save PDF
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <IconClose size={14} /> Close
            </button>
          </div>
        </div>

        {/* Printable Document Area */}
        <div className="invoice-printable-content" id="printable-invoice">
          {/* Header */}
          <div className="invoice-header">
            <div>
              <div className="invoice-logo">WriteMyWords</div>
              <div className="invoice-subtext">Academic Guidance & Project Support Platform</div>
              <div className="invoice-subtext">contact@writemywords.com · www.writemywords.com</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="invoice-badge-paid">
                {docType === 'student_invoice' ? 'PAYMENT SETTLED & VERIFIED' : 'EARNINGS VOUCHER (80% NET)'}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 8 }}>
                {docType === 'student_invoice' ? invoiceNumber : voucherNumber}
              </div>
              <div className="invoice-subtext">Date: {invoiceDate}</div>
            </div>
          </div>

          <hr className="invoice-divider" />

          {/* Party Details */}
          <div className="invoice-parties-grid">
            <div className="invoice-party-col">
              <div className="invoice-party-title">STUDENT (REQUESTER)</div>
              <div style={{ fontWeight: 600, fontSize: 15, marginTop: 4 }}>
                {request.requester_name || 'Student'}
              </div>
              <div className="invoice-subtext">Service: Academic Assignment Guidance</div>
              <div className="invoice-subtext">Mode: Online Razorpay Escrow</div>
            </div>
            <div className="invoice-party-col">
              <div className="invoice-party-title">EXPERT (DELIVERER)</div>
              <div style={{ fontWeight: 600, fontSize: 15, marginTop: 4 }}>
                {request.helper_name || 'Verified Expert'}
              </div>
              <div className="invoice-subtext">Deliverable: Solution Guidance & Document</div>
              <div className="invoice-subtext">Disbursement: Within 24–48 hours</div>
            </div>
          </div>

          {/* Itemized Table */}
          <table className="invoice-table">
            <thead>
              <tr>
                <th>Assignment Description</th>
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
                    <div style={{ fontSize: 12, color: 'var(--blue)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <IconPaperclip size={13} color="var(--blue)" /> Deliverable: {request.delivery_file_name}
                    </div>
                  )}
                </td>
                <td>{request.category}</td>
                <td>{request.academic_level}</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>₹{grossAmount.toLocaleString('en-IN')}</td>
              </tr>
            </tbody>
          </table>

          {/* Total Calculation Box */}
          {docType === 'student_invoice' ? (
            /* Student View: 100% Gross */
            <div className="invoice-total-box">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span className="invoice-subtext">Subtotal</span>
                <span>₹{grossAmount.toLocaleString('en-IN')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span className="invoice-subtext">Platform Processing & Escrow</span>
                <span>₹0.00 (Inclusive)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1.5px solid var(--border)', paddingTop: 8, fontSize: 16, fontWeight: 700 }}>
                <span>Total Paid Amount</span>
                <span style={{ color: 'var(--success)' }}>₹{grossAmount.toLocaleString('en-IN')}</span>
              </div>
            </div>
          ) : (
            /* Expert View: 80% Net Payout with 20% platform fee itemized */
            <div className="invoice-total-box" style={{ background: '#f8fafc', border: '1.5px solid #a7f3d0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span className="invoice-subtext">Gross Project Value</span>
                <span>₹{grossAmount.toLocaleString('en-IN')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: 'var(--blue)' }}>
                <span className="invoice-subtext">Platform Fee (20%)</span>
                <span>-₹{platformFee.toLocaleString('en-IN')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1.5px solid #a7f3d0', paddingTop: 8, fontSize: 16, fontWeight: 700 }}>
                <span>Net Expert Payout (80%)</span>
                <span style={{ color: 'var(--success)' }}>₹{helperPayout.toLocaleString('en-IN')}</span>
              </div>
            </div>
          )}

          {/* Payment & Disbursement Notices */}
          <div className="invoice-footer-notes">
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Transaction & Gateway Reference:</div>
            <div>Payment Reference: <code>{request.razorpay_payment_id || 'RZP-PAID-' + (request.id || '').slice(0, 10)}</code></div>
            <div>Order Reference: <code>{request.razorpay_order_id || 'ORDER-' + (request.id || '').slice(0, 10)}</code></div>
            
            {docType === 'expert_voucher' && (
              <div style={{ marginTop: 10, padding: '10px 12px', background: '#ecfdf5', borderRadius: 8, border: '1px solid #a7f3d0', color: '#065f46', fontSize: 12.5 }}>
                <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IconPhone size={14} color="#065f46" /> Helper Disbursement Policy:
                </div>
                <div style={{ marginTop: 2 }}>
                  <strong>We will call you within 24 to 48 hours, after approval of your submitted assignment for payment.</strong>
                </div>
              </div>
            )}

            <div style={{ marginTop: 8, fontStyle: 'italic', fontSize: 11.5, color: 'var(--ink-soft)' }}>
              This is a computer-generated tax document and requires no physical signature.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
