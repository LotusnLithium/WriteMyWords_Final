import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import {
  adminApproveTransaction, adminRefundOrRejectTransaction, adminUpdateUserRole,
  fetchAdminAllRequests, fetchAdminAllUsers,
} from '../lib/supabaseClient';
import InvoiceModal from '../components/InvoiceModal.jsx';
import {
  IconActivity, IconAlertOctagon, IconCheck, IconCheckCircle, IconCheckSquare,
  IconClose, IconCopy, IconDollarSign, IconDownload, IconFileText, IconHandshake,
  IconPaperclip, IconPhone, IconPrinter, IconReceipt, IconRefreshCw, IconSearch,
  IconShield, IconTrendingUp, IconUser,
} from '../components/Icons.jsx';

export default function AdminDashboard() {
  const { user, authLoading, toast } = useApp();
  const [requests, setRequests] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('approvals'); // 'approvals', 'ledger', 'users'
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Action modals & states
  const [actionModal, setActionModal] = useState(null); // { type: 'approve' | 'refund', request: obj, notes: '' }
  const [actionBusy, setActionBusy] = useState(false);
  const [invoiceRequest, setInvoiceRequest] = useState(null);
  const [updatingRoleUserId, setUpdatingRoleUserId] = useState(null);

  // Check if current user is admin
  const isAdmin = user && (user.role === 'admin' || user.email?.toLowerCase().includes('admin'));

  const loadAdminData = useCallback(async () => {
    try {
      setRefreshing(true);
      const [allReqs, allProfiles] = await Promise.all([
        fetchAdminAllRequests(),
        fetchAdminAllUsers(),
      ]);
      setRequests(allReqs || []);
      setUsersList(allProfiles || []);
    } catch (err) {
      console.error('Failed to load admin data:', err);
      toast('Could not fetch latest platform data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    if (isAdmin) {
      loadAdminData();
    } else {
      setLoading(false);
    }
  }, [isAdmin, loadAdminData]);

  // Financial Metrics Calculation
  const metrics = useMemo(() => {
    let gmv = 0;
    let platformRevenue = 0;
    let helperPayouts = 0;
    let pendingApprovalCount = 0;
    let pendingApprovalVolume = 0;

    requests.forEach((r) => {
      const amount = Number(r.amount_paid || r.budget_max || r.budget_min || 0);
      
      // Approved / Completed transactions
      if (r.status === 'approved') {
        gmv += amount;
        const fee = Number(r.platform_fee_amount || Math.round(amount * 0.10));
        platformRevenue += fee;
        helperPayouts += (amount - fee);
      } 
      // Tasks pending admin escrow approval or delivered with payment held
      else if (r.status === 'pending_approval' || (r.status === 'delivered' && r.amount_paid > 0)) {
        pendingApprovalCount += 1;
        pendingApprovalVolume += amount;
      }
    });

    return {
      gmv,
      platformRevenue,
      helperPayouts,
      pendingApprovalCount,
      pendingApprovalVolume,
      totalRequests: requests.length,
      totalUsers: usersList.length,
    };
  }, [requests, usersList]);

  // Escrow Approvals Queue (Tasks requiring Admin sign-off)
  const pendingApprovals = useMemo(() => {
    return requests.filter((r) => 
      r.status === 'pending_approval' || 
      (r.status === 'delivered' && r.delivery_text) ||
      (r.amount_paid > 0 && r.status !== 'approved' && r.status !== 'cancelled' && r.status !== 'refunded')
    );
  }, [requests]);

  // Filtered Ledger
  const filteredLedger = useMemo(() => {
    return requests.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        r.title?.toLowerCase().includes(q) ||
        r.category?.toLowerCase().includes(q) ||
        r.requester_name?.toLowerCase().includes(q) ||
        r.helper_name?.toLowerCase().includes(q) ||
        r.id?.toLowerCase().includes(q) ||
        r.razorpay_payment_id?.toLowerCase().includes(q)
      );
    });
  }, [requests, statusFilter, searchQuery]);

  if (authLoading || loading) {
    return (
      <div className="wrap" style={{ padding: '80px 0', textAlign: 'center' }}>
        <div style={{ fontSize: 16, color: 'var(--ink-soft)' }}>Loading Admin Portal…</div>
      </div>
    );
  }

  // Security guard: Only authorized admins
  if (!user || !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  // Handle Admin Approving a Transaction & Releasing Payout
  async function handleConfirmApprove() {
    if (!actionModal?.request || actionBusy) return;
    setActionBusy(true);
    const req = actionModal.request;

    try {
      await adminApproveTransaction(req.id, user.id, actionModal.notes);
      toast(`Transaction for "${req.title.slice(0, 30)}…" approved! 90% payout authorized.`);
      setActionModal(null);
      await loadAdminData();
    } catch (err) {
      console.error('Approval failed:', err);
      toast(err.message || 'Could not approve transaction.');
    } finally {
      setActionBusy(false);
    }
  }

  // Handle Admin Rejecting/Refunding a Transaction
  async function handleConfirmRefund() {
    if (!actionModal?.request || actionBusy) return;
    setActionBusy(true);
    const req = actionModal.request;

    try {
      await adminRefundOrRejectTransaction(req.id, user.id, {
        action: actionModal.type === 'cancel' ? 'cancel' : 'refunded',
        reason: actionModal.notes,
      });
      toast(`Transaction ${actionModal.type === 'cancel' ? 'cancelled' : 'marked refunded'}.`);
      setActionModal(null);
      await loadAdminData();
    } catch (err) {
      console.error('Refund failed:', err);
      toast(err.message || 'Could not process refund.');
    } finally {
      setActionBusy(false);
    }
  }

  // Handle User Role Change
  async function handleRoleChange(userId, nextRole) {
    setUpdatingRoleUserId(userId);
    try {
      await adminUpdateUserRole(userId, nextRole);
      toast(`User role updated to ${nextRole}.`);
      await loadAdminData();
    } catch (err) {
      toast('Failed to update role.');
    } finally {
      setUpdatingRoleUserId(null);
    }
  }

  return (
    <section className="wrap" style={{ paddingTop: 'clamp(20px, 4vw, 40px)', paddingBottom: 'clamp(32px, 5vw, 64px)' }}>
      {/* Admin Operations Top Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span className="badge" style={{ background: '#1e1b4b', color: '#c7d2fe', border: '1px solid #4338ca', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px' }}>
              <IconShield size={13} color="#a5b4fc" /> WriteMyWords Admin Central
            </span>
            <span style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>
              Logged in as <strong>{user.name}</strong> ({user.email})
            </span>
          </div>
          <h1 style={{ fontSize: 'clamp(24px, 4.5vw, 32px)', fontWeight: 800 }}>Escrow & Platform Operations</h1>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={loadAdminData}
            disabled={refreshing}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <IconRefreshCw size={14} className={refreshing ? 'spinning' : ''} /> {refreshing ? 'Syncing…' : 'Refresh Data'}
          </button>
          <Link to="/dashboard" className="btn btn-ghost btn-sm">
            Exit to User Dashboard →
          </Link>
        </div>
      </div>

      {/* Financial KPIs Cards */}
      <div className="metric-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: 32 }}>
        <div className="metric" style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #edf2f7 100%)', border: '1.5px solid var(--border-strong)' }}>
          <div className="num" style={{ color: 'var(--ink)', fontSize: 'clamp(22px, 4vw, 28px)' }}>₹{metrics.gmv.toLocaleString('en-IN')}</div>
          <div className="lbl" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <IconTrendingUp size={13} color="var(--blue)" /> Total Gross Volume (GMV)
          </div>
        </div>

        <div className="metric" style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', border: '1.5px solid #bfdbfe' }}>
          <div className="num" style={{ color: 'var(--blue)', fontSize: 'clamp(22px, 4vw, 28px)' }}>₹{metrics.platformRevenue.toLocaleString('en-IN')}</div>
          <div className="lbl" style={{ color: '#1e40af', fontWeight: 600 }}>
            Platform Revenue (10% Fee)
          </div>
        </div>

        <div className="metric" style={{ background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)', border: '1.5px solid #a7f3d0' }}>
          <div className="num" style={{ color: 'var(--success)', fontSize: 'clamp(22px, 4vw, 28px)' }}>₹{metrics.helperPayouts.toLocaleString('en-IN')}</div>
          <div className="lbl" style={{ color: '#065f46', fontWeight: 600 }}>
            Helper Payouts (90% Net)
          </div>
        </div>

        <div className="metric" style={{ background: metrics.pendingApprovalCount > 0 ? 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)' : '#fff', border: metrics.pendingApprovalCount > 0 ? '1.5px solid #fde68a' : '1px solid var(--border)' }}>
          <div className="num" style={{ color: metrics.pendingApprovalCount > 0 ? '#b45309' : 'var(--ink)' }}>
            {metrics.pendingApprovalCount}
          </div>
          <div className="lbl" style={{ color: metrics.pendingApprovalCount > 0 ? '#92400e' : 'var(--ink-soft)' }}>
            Escrow Approvals Queue (₹{metrics.pendingApprovalVolume.toLocaleString('en-IN')})
          </div>
        </div>

        <div className="metric">
          <div className="num">{metrics.totalUsers}</div>
          <div className="lbl">Total Registered Users</div>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="chip-row" style={{ marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
        <button
          className={`chip ${activeTab === 'approvals' ? 'selected' : ''}`}
          onClick={() => setActiveTab('approvals')}
          style={{ fontSize: 14, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <IconCheckSquare size={16} /> Escrow Approvals
          {metrics.pendingApprovalCount > 0 && (
            <span style={{ background: '#b45309', color: '#fff', borderRadius: 99, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>
              {metrics.pendingApprovalCount}
            </span>
          )}
        </button>

        <button
          className={`chip ${activeTab === 'ledger' ? 'selected' : ''}`}
          onClick={() => setActiveTab('ledger')}
          style={{ fontSize: 14, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <IconReceipt size={16} /> All Transactions & Audit Ledger ({requests.length})
        </button>

        <button
          className={`chip ${activeTab === 'users' ? 'selected' : ''}`}
          onClick={() => setActiveTab('users')}
          style={{ fontSize: 14, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <IconUser size={16} /> User Directory & Roles ({usersList.length})
        </button>
      </div>

      {/* TAB 1: ESCROW APPROVALS QUEUE */}
      {activeTab === 'approvals' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 20 }}>Escrow Approvals & Release Queue</h2>
              <p className="muted" style={{ fontSize: 13.5, marginTop: 2 }}>
                Review submitted deliverables and approve transactions to authorize the 90% payout to helpers.
              </p>
            </div>
          </div>

          {pendingApprovals.length === 0 ? (
            <div className="empty" style={{ padding: '48px 20px', background: '#f8fafc' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(47, 143, 104, 0.1)', color: 'var(--success)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <IconCheckCircle size={26} color="var(--success)" />
              </div>
              <h3>All Escrow Clear!</h3>
              <p className="muted" style={{ marginTop: 4, fontSize: 14 }}>
                There are currently no tasks awaiting admin approval.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {pendingApprovals.map((req) => {
                const totalAmt = Number(req.amount_paid || req.budget_max || req.budget_min || 0);
                const platformFee = Number(req.platform_fee_amount || Math.round(totalAmt * 0.10));
                const helperPayout = Number(req.helper_payout_amount || (totalAmt - platformFee));

                return (
                  <div key={req.id} className="card" style={{ border: '1.5px solid #cbd5e1', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span className="badge">{req.category}</span>
                          <span className="badge badge-warn">
                            {req.status === 'pending_approval' ? 'Payment in Escrow' : req.status === 'delivered' ? 'Delivered Guidance' : req.status}
                          </span>
                          <span className="muted" style={{ fontSize: 12 }}>
                            Task ID: <code>{req.id.slice(0, 8)}</code>
                          </span>
                        </div>
                        <h3 style={{ fontSize: 18, marginTop: 8 }}>{req.title}</h3>
                        <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 4 }}>
                          Topic: <strong>{req.subject || 'General'}</strong> · Level: <strong>{req.academic_level}</strong>
                        </div>
                      </div>

                      {/* Financial Breakdown Card */}
                      <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', minWidth: 240, textAlign: 'right' }}>
                        <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Gross Student Payment:</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>₹{totalAmt.toLocaleString('en-IN')}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--blue)', marginTop: 2 }}>
                          Platform Fee (10%): <strong>₹{platformFee.toLocaleString('en-IN')}</strong>
                        </div>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--success)', marginTop: 2 }}>
                          Helper Payout (90%): ₹{helperPayout.toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>

                    {/* Parties Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-soft)' }}>Student (Requester)</div>
                        <div style={{ fontWeight: 600, fontSize: 14, marginTop: 2 }}>{req.requester_name || 'Student'}</div>
                        <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>User ID: {req.user_id.slice(0, 8)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-soft)' }}>Helper (Expert)</div>
                        <div style={{ fontWeight: 600, fontSize: 14, marginTop: 2 }}>{req.helper_name || 'Assigned Expert'}</div>
                        <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Helper ID: {req.helper_id ? req.helper_id.slice(0, 8) : 'Not assigned'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-soft)' }}>Payment Gateway Reference</div>
                        <div style={{ fontSize: 12.5, marginTop: 2 }}>
                          Payment ID: <code>{req.razorpay_payment_id || 'Pending / Recorded'}</code>
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>
                          Order ID: <code>{req.razorpay_order_id || 'N/A'}</code>
                        </div>
                      </div>
                    </div>

                    {/* Deliverables & Brief Preview */}
                    <div style={{ marginTop: 16, padding: '12px 14px', background: '#f1f5f9', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {req.delivery_text && (
                        <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>
                          <strong>Helper Deliverable Guidance:</strong> {req.delivery_text}
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                        {req.delivery_file_url && (
                          <a
                            href={req.delivery_file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-primary btn-sm"
                            download
                            style={{ fontSize: 12.5, padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                          >
                            <IconFileText size={14} /> Download Delivered Solution ({req.delivery_file_name || 'Word Document'})
                          </a>
                        )}

                        {req.attachment_url && (
                          <a
                            href={req.attachment_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-ghost btn-sm"
                            download
                            style={{ fontSize: 12.5, padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                          >
                            <IconPaperclip size={14} /> View Student Brief ({req.attachment_name || 'File'})
                          </a>
                        )}

                        <Link to={`/request/${req.id}`} target="_blank" className="btn btn-ghost btn-sm" style={{ fontSize: 12.5, padding: '6px 12px' }}>
                          Open Chat & Full Details ↗
                        </Link>
                      </div>
                    </div>

                    {/* Admin Actions Bar */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--error)', borderColor: 'rgba(217,85,85,0.3)' }}
                        onClick={() => setActionModal({ type: 'refund', request: req, notes: '' })}
                      >
                        Refund / Reject
                      </button>

                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        style={{ background: 'var(--success)', borderColor: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        onClick={() => setActionModal({ type: 'approve', request: req, notes: '' })}
                      >
                        <IconCheckCircle size={15} color="#fff" /> Approve Transaction & Release ₹{helperPayout.toLocaleString('en-IN')} Payout
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ALL TRANSACTIONS & AUDIT LEDGER */}
      {activeTab === 'ledger' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ fontSize: 20 }}>All Transactions & Operations Ledger</h2>
              <p className="muted" style={{ fontSize: 13.5, marginTop: 2 }}>
                Full system audit of payments, platform fees, and task deliverables.
              </p>
            </div>

            {/* Search & Status Filter */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', width: '100%', maxWidth: 500 }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by title, student, helper, payment ID…"
                  style={{ width: '100%', paddingLeft: 34, fontSize: 13.5, height: 38 }}
                />
                <span style={{ position: 'absolute', left: 10, top: 10, color: 'var(--ink-soft)' }}>
                  <IconSearch size={15} />
                </span>
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ width: 'auto', fontSize: 13.5, height: 38, padding: '4px 10px' }}
              >
                <option value="all">All Statuses</option>
                <option value="approved">Approved & Completed</option>
                <option value="pending_approval">Pending Admin Approval</option>
                <option value="delivered">Delivered</option>
                <option value="claimed">In Progress (Claimed)</option>
                <option value="open">Open</option>
                <option value="refunded">Refunded</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
            <table className="invoice-table" style={{ width: '100%', minWidth: 840 }}>
              <thead>
                <tr>
                  <th>Date & Task</th>
                  <th>Student</th>
                  <th>Helper</th>
                  <th>Gross Paid</th>
                  <th>10% Fee</th>
                  <th>90% Payout</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLedger.length ? filteredLedger.map((r) => {
                  const gross = Number(r.amount_paid || r.budget_max || r.budget_min || 0);
                  const fee = Number(r.platform_fee_amount || Math.round(gross * 0.10));
                  const payout = Number(r.helper_payout_amount || (gross - fee));
                  const dateStr = new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

                  return (
                    <tr key={r.id}>
                      <td style={{ maxWidth: 220 }}>
                        <strong style={{ fontSize: 13.5, color: 'var(--ink)' }}>{r.title}</strong>
                        <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 2 }}>
                          {dateStr} · {r.category}
                        </div>
                      </td>
                      <td style={{ fontSize: 13 }}>{r.requester_name || 'Student'}</td>
                      <td style={{ fontSize: 13 }}>{r.helper_name || '—'}</td>
                      <td style={{ fontWeight: 600, fontSize: 13.5 }}>₹{gross.toLocaleString('en-IN')}</td>
                      <td style={{ color: 'var(--blue)', fontSize: 13 }}>₹{fee.toLocaleString('en-IN')}</td>
                      <td style={{ color: 'var(--success)', fontWeight: 600, fontSize: 13 }}>₹{payout.toLocaleString('en-IN')}</td>
                      <td>
                        <span className={`badge ${r.status === 'approved' ? 'badge-success' : r.status === 'pending_approval' ? 'badge-warn' : r.status === 'claimed' ? 'badge-blue' : ''}`} style={{ fontSize: 11 }}>
                          {r.status === 'approved' ? 'Approved & Settled' : r.status === 'pending_approval' ? 'Escrow Review' : r.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => setInvoiceRequest(r)}
                            style={{ padding: '3px 8px', fontSize: 11.5 }}
                            title="View Invoice"
                          >
                            <IconReceipt size={13} /> Invoice
                          </button>
                          {r.status === 'pending_approval' && (
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => setActionModal({ type: 'approve', request: r, notes: '' })}
                              style={{ padding: '3px 8px', fontSize: 11.5 }}
                            >
                              Approve
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--ink-soft)' }}>
                      No matching records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: USER DIRECTORY & ROLES */}
      {activeTab === 'users' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 20 }}>User Directory & Permissions</h2>
              <p className="muted" style={{ fontSize: 13.5, marginTop: 2 }}>
                Manage registered Students, Expert Helpers, and Administrator privileges.
              </p>
            </div>
          </div>

          <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
            <table className="invoice-table" style={{ width: '100%', minWidth: 700 }}>
              <thead>
                <tr>
                  <th>User</th>
                  <th>WhatsApp / Phone</th>
                  <th>Current Role</th>
                  <th>Joined</th>
                  <th style={{ textAlign: 'right' }}>Role Change</th>
                </tr>
              </thead>
              <tbody>
                {usersList.map((u) => {
                  const joinedDate = new Date(u.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
                  return (
                    <tr key={u.id}>
                      <td>
                        <strong style={{ fontSize: 13.5, color: 'var(--ink)' }}>{u.name || 'Anonymous User'}</strong>
                        <div style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>ID: <code>{u.id.slice(0, 8)}</code></div>
                      </td>
                      <td style={{ fontSize: 13 }}>{u.whatsapp || '—'}</td>
                      <td>
                        <span className="badge" style={{
                          fontSize: 11,
                          background: u.role === 'admin' ? '#1e1b4b' : u.role === 'expert' ? '#ecfdf5' : 'var(--paper)',
                          color: u.role === 'admin' ? '#c7d2fe' : u.role === 'expert' ? '#065f46' : 'var(--ink)',
                        }}>
                          {u.role === 'admin' ? 'Administrator' : u.role === 'expert' ? 'Expert Helper' : 'Student'}
                        </span>
                      </td>
                      <td style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>{joinedDate}</td>
                      <td style={{ textAlign: 'right' }}>
                        <select
                          value={u.role}
                          disabled={updatingRoleUserId === u.id}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          style={{ padding: '4px 8px', fontSize: 12, width: 'auto' }}
                        >
                          <option value="student">Student</option>
                          <option value="expert">Expert Helper</option>
                          <option value="admin">Administrator</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ACTION CONFIRMATION MODAL (Approve Payout / Refund) */}
      {actionModal && (
        <div className="invoice-overlay" style={{ zIndex: 99999 }}>
          <div className="auth-card" style={{ maxWidth: 520, width: '100%', margin: 'auto', background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 19 }}>
                {actionModal.type === 'approve' ? 'Approve Transaction & Release Payout' : 'Reject / Refund Transaction'}
              </h3>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setActionModal(null)}
                style={{ padding: '4px 8px' }}
              >
                <IconClose size={16} />
              </button>
            </div>

            <p style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
              Task: <strong>{actionModal.request.title}</strong>
            </p>

            {actionModal.type === 'approve' ? (
              <div style={{ background: '#f8fafc', border: '1.5px solid #a7f3d0', borderRadius: 8, padding: '14px', margin: '14px 0' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#065f46', textTransform: 'uppercase', marginBottom: 8 }}>
                  Financial Settlement Breakdown
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, padding: '3px 0' }}>
                  <span>Gross Student Payment:</span>
                  <strong>₹{Number(actionModal.request.amount_paid || actionModal.request.budget_max || 0).toLocaleString('en-IN')}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, padding: '3px 0', color: 'var(--blue)' }}>
                  <span>Platform Commission (10%):</span>
                  <strong>+₹{Math.round(Number(actionModal.request.amount_paid || actionModal.request.budget_max || 0) * 0.10).toLocaleString('en-IN')}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '6px 0', borderTop: '1px solid #cbd5e1', marginTop: 6, color: 'var(--success)' }}>
                  <span>Net Payout to Helper (90%):</span>
                  <strong style={{ fontSize: 16 }}>₹{Math.round(Number(actionModal.request.amount_paid || actionModal.request.budget_max || 0) * 0.90).toLocaleString('en-IN')}</strong>
                </div>
              </div>
            ) : (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px', margin: '14px 0', color: '#991b1b', fontSize: 13 }}>
                Warning: This will cancel or reverse the transaction status and alert the student and helper.
              </div>
            )}

            <div className="field" style={{ marginTop: 12 }}>
              <label>Admin Audit Note (Optional)</label>
              <input
                type="text"
                value={actionModal.notes}
                onChange={(e) => setActionModal((m) => ({ ...m, notes: e.target.value }))}
                placeholder="e.g. Verified Word doc deliverable and rubric completion"
                style={{ fontSize: 13.5 }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                type="button"
                className="btn btn-ghost btn-block"
                onClick={() => setActionModal(null)}
                disabled={actionBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`btn ${actionModal.type === 'approve' ? 'btn-primary' : 'btn-ghost'} btn-block`}
                style={actionModal.type === 'approve' ? { background: 'var(--success)', borderColor: 'var(--success)' } : { color: 'var(--error)', borderColor: 'var(--error)' }}
                onClick={actionModal.type === 'approve' ? handleConfirmApprove : handleConfirmRefund}
                disabled={actionBusy}
              >
                {actionBusy ? 'Processing…' : actionModal.type === 'approve' ? 'Confirm & Authorize Payout' : 'Confirm Refund'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Viewer Modal */}
      {invoiceRequest && (
        <InvoiceModal
          request={invoiceRequest}
          user={user}
          onClose={() => setInvoiceRequest(null)}
        />
      )}
    </section>
  );
}
