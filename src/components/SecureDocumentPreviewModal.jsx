import React, { useEffect, useState, useRef } from 'react';
import {
  IconClose, IconFileText, IconLock, IconShield, IconCheckCircle, IconEye, IconPaperclip
} from './Icons.jsx';

export default function SecureDocumentPreviewModal({
  request,
  user,
  onClose,
  onApproveAndPay,
  busy = false,
}) {
  const [isScreenProtected, setIsScreenProtected] = useState(false);
  const containerRef = useRef(null);

  const finalizedAmt = Number(request?.finalized_price || request?.amount_paid || request?.budget_max || request?.budget_min || 0);
  const fileName = request?.delivery_file_name || 'Completed_Assignment_Deliverable.docx';
  const fileUrl = request?.delivery_file_url || '';

  const studentIdentifier = user?.name || user?.email || `Student_${(user?.id || 'User').slice(0, 6)}`;
  const waterMarkDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  // Anti-Screen Capture & Anti-Leak Listeners
  useEffect(() => {
    // 1. Detect Window Blur / Focus loss (e.g. Snipping tool, recording overlay, window switch)
    const handleBlur = () => {
      setIsScreenProtected(true);
    };
    const handleFocus = () => {
      setIsScreenProtected(false);
    };

    // 2. Visibility change (tab switch)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsScreenProtected(true);
      } else {
        setIsScreenProtected(false);
      }
    };

    // 3. Block Keyboard shortcuts: Print, Save, Screen Capture keys
    const handleKeyDown = (e) => {
      // Print: Ctrl+P / Cmd+P
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        e.stopPropagation();
        alert('🔒 Printing is strictly disabled in Protected Preview Mode. Please complete payment to download original files.');
        return false;
      }
      // Save Webpage: Ctrl+S / Cmd+S
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      // Copy: Ctrl+C / Cmd+C inside modal
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      // PrintScreen key
      if (e.key === 'PrintScreen') {
        setIsScreenProtected(true);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText('WriteMyWords Protected Document — Copying & Screenshots are prohibited.');
        }
        setTimeout(() => setIsScreenProtected(false), 2000);
      }
      // Escape closes modal
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('keydown', handleKeyDown, { capture: true });

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [onClose]);

  // Split delivery text into realistic formatted sections for the document preview
  const deliverySections = React.useMemo(() => {
    const raw = request?.delivery_text || '';
    if (!raw.trim()) {
      return [
        {
          title: 'Section 1: Academic Guidance & Problem Formulation',
          content: 'The assigned academic expert has prepared the comprehensive analysis, structural outline, core arguments, and supporting evidence tailored specifically to the project prompt.',
        },
        {
          title: 'Section 2: Synthesis, Methodology & Working Notes',
          content: 'Detailed methodology, step-by-step problem resolution, and academic synthesis have been compiled in the primary deliverable document.',
        },
        {
          title: 'Section 3: Bibliography & Citation Standards',
          content: 'Referencing standards, scholarly citations, and final structural checks are finalized in the attached Word document.',
        },
      ];
    }

    const paragraphs = raw.split(/\n\s*\n/).filter(Boolean);
    if (paragraphs.length <= 1) {
      return [
        { title: 'Executive Overview & Guidance', content: raw },
        { title: 'Detailed Working Notes & Findings', content: 'Comprehensive analysis and verified documentation compiled in the attached deliverable document.' },
        { title: 'Academic References & Standards', content: 'Formatted according to undergraduate/postgraduate submission standards.' },
      ];
    }

    return paragraphs.map((p, idx) => ({
      title: `Part ${idx + 1}: ${idx === 0 ? 'Project Solution Overview' : idx === 1 ? 'Detailed Analysis & Methodology' : 'Summary & Annotated References'}`,
      content: p,
    }));
  }, [request?.delivery_text]);

  return (
    <div
      className="invoice-overlay"
      onClick={onClose}
      style={{
        zIndex: 99999,
        background: 'rgba(10, 14, 35, 0.85)',
        backdropFilter: 'blur(8px)',
        padding: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        className="secure-preview-modal-card"
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
        onCopy={(e) => e.preventDefault()}
        onCut={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
        style={{
          width: '100%',
          maxWidth: '900px',
          height: '92vh',
          maxHeight: '860px',
          background: '#ffffff',
          borderRadius: 16,
          boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
      >
        {/* Anti-Screen Capture Shield Overlay */}
        {isScreenProtected && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 1000,
              background: '#0f172a',
              color: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
              textAlign: 'center',
            }}
          >
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(239,68,68,0.2)', border: '1.5px solid #ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <IconLock size={32} color="#f87171" />
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: '#ffffff', marginBottom: 8 }}>
              🛡️ Protected Document Screen Shield Active
            </h3>
            <p style={{ color: '#94a3b8', fontSize: 14, maxWidth: 460, lineHeight: 1.6 }}>
              WriteMyWords Anti-Screen Capture and Leak Shield is currently protecting this unpaid deliverable.
              Please click back on this window to resume previewing.
            </p>
          </div>
        )}

        {/* Modal Top Header Bar */}
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid #e2e8f0',
            background: '#0f172a',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: 'rgba(59, 130, 246, 0.2)',
                border: '1px solid rgba(59, 130, 246, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <IconLock size={18} color="#60a5fa" />
            </div>
            <div style={{ overflow: 'hidden', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: '#f8fafc', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {fileName}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 99,
                    background: 'rgba(234, 179, 8, 0.2)',
                    color: '#fde047',
                    border: '1px solid rgba(234, 179, 8, 0.4)',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  Watermarked Preview
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>🔒 Read-Only Escrow Inspection</span>
                <span>•</span>
                <span style={{ color: '#f87171' }}>Direct Download & Copy Disabled Until Payment</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={onApproveAndPay}
              disabled={busy}
              style={{
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: 13,
                padding: '7px 14px',
                border: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <IconCheckCircle size={14} color="#ffffff" />
              {busy ? 'Processing…' : `Pay ₹${finalizedAmt} to Download Original`}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost btn-sm"
              style={{
                color: '#cbd5e1',
                padding: '6px 10px',
                borderColor: 'rgba(255,255,255,0.15)',
              }}
            >
              <IconClose size={16} />
            </button>
          </div>
        </div>

        {/* Security Notice Strip */}
        <div
          style={{
            background: '#fffbeb',
            borderBottom: '1px solid #fef3c7',
            padding: '8px 18px',
            fontSize: 12.5,
            color: '#92400e',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
            <IconShield size={14} color="#b45309" />
            <span>
              Preview Mode Active: Verify structure, research depth, and formatting. Download will unlock immediately upon payment approval.
            </span>
          </div>
          <div style={{ fontSize: 11.5, color: '#b45309', fontWeight: 600 }}>
            Protected for {studentIdentifier} • {waterMarkDate}
          </div>
        </div>

        {/* Document Body & Multi-Page Viewer */}
        <div
          ref={containerRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            background: '#cbd5e1',
            padding: '24px 16px',
            position: 'relative',
          }}
        >
          {/* Dense Diagonal Anti-Screenshot Watermark Layer */}
          <div
            className="escrow-modal-watermark-grid"
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              pointerEvents: 'none',
              zIndex: 30,
              opacity: 0.12,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: '60px 40px',
              padding: '40px 20px',
              overflow: 'hidden',
            }}
          >
            {Array.from({ length: 48 }).map((_, i) => (
              <div
                key={i}
                style={{
                  transform: 'rotate(-28deg)',
                  fontSize: '12px',
                  fontWeight: 800,
                  color: '#0f172a',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  lineHeight: 1.4,
                  userSelect: 'none',
                }}
              >
                <div>🔒 WRITEMYWORDS ESCROW</div>
                <div style={{ fontSize: '10px', color: '#334155' }}>PREVIEW ONLY · UNPAID</div>
                <div style={{ fontSize: '9px', color: '#64748b' }}>{studentIdentifier}</div>
              </div>
            ))}
          </div>

          {/* Academic Document Paper Container */}
          <div
            style={{
              maxWidth: '720px',
              margin: '0 auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
              position: 'relative',
              zIndex: 10,
            }}
          >
            {/* Page 1: Formal Cover & Verification Sheet */}
            <div
              className="academic-paper-sheet"
              style={{
                background: '#ffffff',
                borderRadius: 4,
                boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                padding: '44px 48px',
                minHeight: '600px',
                position: 'relative',
                border: '1px solid #e2e8f0',
              }}
            >
              {/* Top Document Header */}
              <div style={{ borderBottom: '2px solid #0f172a', paddingBottom: 16, marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--blue)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    WriteMyWords Academic Verification Deliverable
                  </div>
                  <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', marginTop: 4, fontFamily: 'var(--serif)' }}>
                    {request?.title || 'Assignment Deliverable'}
                  </h1>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      border: '1px solid #bfdbfe',
                      padding: '3px 10px',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                    }}
                  >
                    Page 1 / 3
                  </span>
                </div>
              </div>

              {/* Metadata Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: 12,
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  padding: '12px 16px',
                  marginBottom: 24,
                  fontSize: 13,
                }}
              >
                <div>
                  <span style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', fontWeight: 600, display: 'block' }}>Subject</span>
                  <strong style={{ color: '#0f172a' }}>{request?.subject || 'General Academic'}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', fontWeight: 600, display: 'block' }}>Academic Level</span>
                  <strong style={{ color: '#0f172a' }}>{request?.academic_level || 'Undergraduate'}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', fontWeight: 600, display: 'block' }}>Deliverable File</span>
                  <strong style={{ color: '#1d4ed8', wordBreak: 'break-all' }}>{fileName}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', fontWeight: 600, display: 'block' }}>Verification Status</span>
                  <strong style={{ color: '#16a34a' }}>✓ Completed by Expert</strong>
                </div>
              </div>

              {/* Section 1 Preview Content */}
              <div style={{ color: '#334155', fontSize: 14.5, lineHeight: 1.75 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 10, borderBottom: '1px solid #f1f5f9', paddingBottom: 6 }}>
                  {deliverySections[0]?.title || 'Section 1: Solution Abstract & Core Framework'}
                </h3>
                <p style={{ marginBottom: 16 }}>
                  {deliverySections[0]?.content}
                </p>
                <div style={{ padding: '12px 16px', background: '#f1f5f9', borderRadius: 6, borderLeft: '4px solid var(--blue)', margin: '16px 0', fontSize: 13.5, color: '#475569' }}>
                  <strong>Deliverable Summary:</strong> The expert has completed the full required solution corresponding to your instructions, academic citations, and formatting guidelines. The document is packaged in <strong>{fileName}</strong>.
                </div>
              </div>

              {/* Security Page Watermark Stamp */}
              <div
                style={{
                  marginTop: 36,
                  paddingTop: 16,
                  borderTop: '1px dashed #cbd5e1',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 11.5,
                  color: '#94a3b8',
                }}
              >
                <span>WriteMyWords Escrow Protected Deliverable • Read-Only Inspection</span>
                <span>Watermark ID: WMW-SEC-{request?.id?.slice(0, 8)}</span>
              </div>
            </div>

            {/* Page 2: Analytical Findings & Working Methodology */}
            <div
              className="academic-paper-sheet"
              style={{
                background: '#ffffff',
                borderRadius: 4,
                boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                padding: '44px 48px',
                minHeight: '600px',
                position: 'relative',
                border: '1px solid #e2e8f0',
              }}
            >
              <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: 12, marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  {request?.title} • Working Analysis
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8' }}>Page 2 / 3</span>
              </div>

              <div style={{ color: '#334155', fontSize: 14.5, lineHeight: 1.75 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 10, borderBottom: '1px solid #f1f5f9', paddingBottom: 6 }}>
                  {deliverySections[1]?.title || 'Section 2: Detailed Methodology, Findings & Arguments'}
                </h3>
                <p style={{ marginBottom: 16 }}>
                  {deliverySections[1]?.content || 'The core academic findings, mathematical steps, empirical discussions, and synthesis have been structured to ensure zero plagiarism and complete relevance.'}
                </p>

                {deliverySections[2] && (
                  <>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginTop: 24, marginBottom: 10, borderBottom: '1px solid #f1f5f9', paddingBottom: 6 }}>
                      {deliverySections[2]?.title}
                    </h3>
                    <p style={{ marginBottom: 16 }}>
                      {deliverySections[2]?.content}
                    </p>
                  </>
                )}

                {/* Encrypted Protection Box */}
                <div
                  style={{
                    marginTop: 24,
                    background: 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)',
                    border: '1.5px solid #bfdbfe',
                    borderRadius: 8,
                    padding: '20px 24px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                    <IconLock size={22} color="#1d4ed8" />
                  </div>
                  <h4 style={{ fontSize: 15, fontWeight: 700, color: '#1e3a8a', marginBottom: 4 }}>
                    Remaining Pages & Direct Document Download Protected
                  </h4>
                  <p style={{ color: '#475569', fontSize: 13, maxWidth: 440, margin: '0 auto 14px', lineHeight: 1.5 }}>
                    The original, editable Word file (<strong>{fileName}</strong>) containing full uncompressed figures, formulas, code, and references is ready for instant download upon escrow approval.
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={onApproveAndPay}
                    disabled={busy}
                    style={{ fontSize: 13.5, padding: '9px 20px', fontWeight: 700 }}
                  >
                    <IconLock size={14} />
                    {busy ? 'Opening Razorpay…' : `Pay ₹${finalizedAmt} to Unlock & Download Original File`}
                  </button>
                </div>
              </div>

              <div
                style={{
                  marginTop: 36,
                  paddingTop: 16,
                  borderTop: '1px dashed #cbd5e1',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 11.5,
                  color: '#94a3b8',
                }}
              >
                <span>WriteMyWords Escrow Protected Deliverable • Read-Only Inspection</span>
                <span>Watermark ID: WMW-SEC-{request?.id?.slice(0, 8)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Action Bar */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid #e2e8f0',
            background: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 14,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <IconShield size={20} color="var(--success)" style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: '#0f172a' }}>
                100% Secure Escrow Protection
              </div>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                Funds are released to the expert only after quality verification.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onClose}
              style={{ fontSize: 13 }}
            >
              Close Preview
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={onApproveAndPay}
              disabled={busy}
              style={{
                background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)',
                fontSize: 14,
                padding: '10px 22px',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <IconLock size={15} />
              {busy ? 'Opening Razorpay…' : `Approve & Pay ₹${finalizedAmt} to Download`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
