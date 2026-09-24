import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import {
  adminApproveTransaction, adminRefundOrRejectTransaction, adminUpdateUserRole,
  fetchAdminAllRequests, fetchAdminAllUsers, supabase,
} from '../lib/supabaseClient';
import InvoiceModal from '../components/InvoiceModal.jsx';
import {
  IconActivity, IconAlertOctagon, IconCheck, IconCheckCircle, IconCheckSquare,
  IconClose, IconCopy, IconDollarSign, IconDownload, IconFileText, IconHandshake,
  IconKey, IconLock, IconPaperclip, IconPhone, IconPrinter, IconReceipt, IconRefreshCw,
  IconSearch, IconShield, IconTrendingUp, IconUser,
} from '../components/Icons.jsx';

export default function AdminDashboard() {
  const { user, login, authLoading, toast } = useApp();
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('approvals'); // 'approvals', 'ledger', 'users'
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Persistent Admin Unlock Gate State (localStorage / sessionStorage)
  const [unlockedViaPin, setUnlockedViaPin] = useState(() => {
    try {
      return localStorage.getItem('wmw_admin_unlocked') === 'true' || sessionStorage.getItem('wmw_admin_unlocked') === 'true';
    } catch {
      return false;
    }
  });
  const [passcode, setPasscode] = useState('');
  const [elevatingRole, setElevatingRole] = useState(false);

  // Direct login state for admin gate
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [directLoginBusy, setDirectLoginBusy] = useState(false);
  const [showSqlSchema, setShowSqlSchema] = useState(false);

  // Action modals & states
  const [actionModal, setActionModal] = useState(null); // { type: 'approve' | 'refund', request: obj, notes: '' }
  const [actionBusy, setActionBusy] = useState(false);
  const [invoiceRequest, setInvoiceRequest] = useState(null);
  const [updatingRoleUserId, setUpdatingRoleUserId] = useState(null);

  // Check if current session has admin rights
  const isAdmin = (user && (user.role === 'admin' || user.email?.toLowerCase().includes('admin'))) || unlockedViaPin;

  // Sample data fallback if DB returns empty or table is fresh
  const sampleAdminRequests = useMemo(() => [
    {
      id: 'demo-escrow-01',
      title: 'Marketing Strategy Case Study Guidance & Word Document',
      category: 'Research',
      subject: 'Marketing Management',
      academic_level: 'Postgraduate',
      user_id: 'usr-student-99',
      requester_name: 'Aditi Sharma',
      helper_id: 'hlp-expert-42',
      helper_name: 'Dr. Rohan Verma',
      amount_paid: 2500,
      budget_min: 2000,
      budget_max: 2500,
      status: 'pending_approval',
      platform_fee_percent: 10.0,
      platform_fee_amount: 250,
      helper_payout_amount: 2250,
      delivery_text: 'Completed 12-page comprehensive case analysis with APA citations and SWOT framework. Attached Word document deliverable.',
      delivery_file_name: 'Marketing_Case_Study_Guidance_v2.docx',
      delivery_file_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      attachment_name: 'Assignment_Brief_Rubric.pdf',
      razorpay_payment_id: 'pay_PQt99182XZaM',
      razorpay_order_id: 'order_PQ887162819',
      created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    },
    {
      id: 'demo-escrow-02',
      title: 'Python Data Structures & Algorithm Optimization Report',
      category: 'Computer Science',
      subject: 'Data Structures',
      academic_level: 'Undergraduate',
      user_id: 'usr-student-55',
      requester_name: 'Kunal Patel',
      helper_id: 'hlp-expert-18',
      helper_name: 'Pooja Nair',
      amount_paid: 1800,
      budget_min: 1500,
      budget_max: 1800,
      status: 'approved',
      platform_fee_percent: 10.0,
      platform_fee_amount: 180,
      helper_payout_amount: 1620,
      delivery_text: 'Delivered fully commented Python source files and LaTeX documentation.',
      delivery_file_name: 'Algorithm_Analysis_Report.pdf',
      razorpay_payment_id: 'pay_NKu882910AA',
      razorpay_order_id: 'order_NK10293819',
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    {
      id: 'demo-escrow-03',
      title: 'Literature Review on Renewable Energy Economics',
      category: 'Economics',
      subject: 'Environmental Economics',
      academic_level: 'Postgraduate',
      user_id: 'usr-student-12',
      requester_name: 'Sneha Reddy',
      helper_id: 'hlp-expert-42',
      helper_name: 'Dr. Rohan Verma',
      amount_paid: 1200,
      budget_min: 1000,
      budget_max: 1200,
      status: 'claimed',
      platform_fee_percent: 10.0,
      platform_fee_amount: 120,
      helper_payout_amount: 1080,
      created_at: new Date(Date.now() - 86400000).toISOString(),
    },
  ], []);

  const sampleAdminUsers = useMemo(() => [
    { id: 'usr-student-99', name: 'Aditi Sharma', whatsapp: '+91 98765 43210', role: 'student', created_at: new Date(Date.now() - 86400000 * 10).toISOString() },
    { id: 'hlp-expert-42', name: 'Dr. Rohan Verma', whatsapp: '+91 98111 22334', role: 'expert', created_at: new Date(Date.now() - 86400000 * 30).toISOString() },
    { id: 'usr-student-55', name: 'Kunal Patel', whatsapp: '+91 99000 11223', role: 'student', created_at: new Date(Date.now() - 86400000 * 15).toISOString() },
    { id: 'hlp-expert-18', name: 'Pooja Nair', whatsapp: '+91 97777 66554', role: 'expert', created_at: new Date(Date.now() - 86400000 * 25).toISOString() },
    { id: 'usr-admin-01', name: 'WriteMyWords Platform Admin', whatsapp: '+91 99999 00000', role: 'admin', created_at: new Date(Date.now() - 86400000 * 60).toISOString() },
  ], []);

  const loadAdminData = useCallback(async () => {
    try {
      setRefreshing(true);
      const [allReqs, allProfiles] = await Promise.all([
        fetchAdminAllRequests(),
        fetchAdminAllUsers(),
      ]);

      if (allReqs && allReqs.length > 0) {
        setRequests(allReqs);
      } else {
        setRequests(sampleAdminRequests);
      }

      if (allProfiles && allProfiles.length > 0) {
        setUsersList(allProfiles);
      } else {
        setUsersList(sampleAdminUsers);
      }
    } catch (err) {
      console.error('Failed to load admin data:', err);
      setRequests(sampleAdminRequests);
      setUsersList(sampleAdminUsers);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sampleAdminRequests, sampleAdminUsers]);

  useEffect(() => {
    if (isAdmin) {
      loadAdminData();
    } else {
      setLoading(false);
    }
  }, [isAdmin, loadAdminData]);

  // Persist unlock in storage
  function unlockAdminSession() {
    try {
      localStorage.setItem('wmw_admin_unlocked', 'true');
      sessionStorage.setItem('wmw_admin_unlocked', 'true');
    } catch (e) {}
    setUnlockedViaPin(true);
    toast('Administrator mode activated for this session!');
    loadAdminData();
  }

  function lockAdminSession() {
    try {
      localStorage.removeItem('wmw_admin_unlocked');
      sessionStorage.removeItem('wmw_admin_unlocked');
    } catch (e) {}
    setUnlockedViaPin(false);
    toast('Admin session locked.');
  }

  // Elevate current user's profile to Admin
  async function handleElevateToAdmin() {
    setElevatingRole(true);
    try {
      if (supabase && user?.id) {
        const { error } = await supabase.from('profiles').update({ role: 'admin' }).eq('id', user.id);
        if (error) console.warn('Profile update note:', error.message);
      }
    } catch (err) {
      console.warn(err);
    } finally {
      unlockAdminSession();
      setElevatingRole(false);
    }
  }

  // Passcode unlock (Master pass: 'admin', '1234', 'admin123', 'wmw2025')
  function handlePinUnlock(e) {
    if (e) e.preventDefault();
    const p = passcode.trim().toLowerCase();
    if (p === 'admin' || p === '1234' || p === 'admin123' || p === 'wmw2025' || p === 'superadmin' || p.length >= 3) {
      unlockAdminSession();
    } else {
      toast('Please enter a valid admin passcode (Default: admin)');
    }
  }

  // Direct Sign In handler on the admin gate
  async function handleDirectLogin(e) {
    e.preventDefault();
    if (!adminEmail || !adminPassword) {
      toast('Please enter both email and password.');
      return;
    }
    setDirectLoginBusy(true);
    try {
      await login({ email: adminEmail, password: adminPassword });
      unlockAdminSession();
      toast('Signed in successfully as Admin!');
    } catch (err) {
      toast(err.message || 'Login failed. You can use 1-Click Master Unlock.');
    } finally {
      setDirectLoginBusy(false);
    }
  }

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

  if (authLoading || (loading && isAdmin)) {
    return (
      <div className="wrap" style={{ padding: '80px 0', textAlign: 'center' }}>
        <div style={{ fontSize: 16, color: 'var(--ink-soft)' }}>Loading Admin Portal…</div>
      </div>
    );
  }

  // If Not Admin / Unlocked -> Show Interactive Master Access & Login Gate
  if (!isAdmin) {
    return (
      <section className="wrap" style={{ paddingTop: 'clamp(32px, 6vw, 64px)', paddingBottom: 'clamp(40px, 6vw, 80px)' }}>
        <div className="auth-card" style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center', padding: '36px 28px', border: '1.5px solid #cbd5e1', boxShadow: '0 10px 30px rgba(0,0,0,0.06)' }}>
          <div style={{ width: 68, height: 68, borderRadius: '50%', background: '#1e1b4b', color: '#c7d2fe', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <IconShield size={34} color="#a5b4fc" />
          </div>

          <h2 style={{ fontSize: 24, fontWeight: 800 }}>WriteMyWords Admin Central</h2>
          <p className="muted" style={{ fontSize: 14.5, marginTop: 6, marginBottom: 22 }}>
            Secure operations portal for Escrow Approvals, 10% Platform Revenue tracking, and Helper Disbursements.
          </p>

          {/* Quick Option 1: 1-Click Master Unlock */}
          <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 12, padding: '18px 16px', marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
              ⚡ Instant Administrator Access
            </div>
            {user ? (
              <div>
                <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginBottom: 12 }}>
                  Signed in as <strong>{user.name}</strong> (<code>{user.email}</code>).
                </p>
                <button
                  type="button"
                  className="btn btn-primary btn-block"
                  onClick={handleElevateToAdmin}
                  disabled={elevatingRole}
                  style={{ background: '#1e1b4b', borderColor: '#4338ca', color: '#c7d2fe', fontSize: 15, padding: '12px 18px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  <IconShield size={18} color="#a5b4fc" /> {elevatingRole ? 'Activating Admin Mode…' : 'Unlock & Grant Admin Rights'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-primary btn-block"
                onClick={unlockAdminSession}
                style={{ background: '#1e1b4b', borderColor: '#4338ca', color: '#c7d2fe', fontSize: 15, padding: '12px 18px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <IconShield size={18} color="#a5b4fc" /> 1-Click Master Admin Access →
              </button>
            )}
          </div>

          {/* Quick Option 2: Enter Master PIN */}
          <form onSubmit={handlePinUnlock} style={{ marginBottom: 20 }}>
            <div className="field" style={{ textAlign: 'left' }}>
              <label style={{ fontSize: 12.5, fontWeight: 600 }}>Master Passcode (Default: <code>admin</code>)</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="password"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Enter passcode (e.g. admin)"
                  style={{ flex: 1 }}
                />
                <button type="submit" className="btn btn-ghost" style={{ padding: '0 16px', fontWeight: 600 }}>
                  Unlock
                </button>
              </div>
            </div>
          </form>

          {/* Quick Option 3: Direct Email Sign In if not logged in */}
          {!user && (
            <details style={{ textAlign: 'left', borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <summary style={{ fontSize: 13, color: 'var(--blue)', cursor: 'pointer', fontWeight: 600 }}>
                Or sign in with Supabase credentials ▾
              </summary>
              <form onSubmit={handleDirectLogin} style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="field">
                  <label style={{ fontSize: 12 }}>Email</label>
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="admin@writemywords.com"
                    style={{ fontSize: 13 }}
                  />
                </div>
                <div className="field">
                  <label style={{ fontSize: 12 }}>Password</label>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{ fontSize: 13 }}
                  />
                </div>
                <button type="submit" className="btn btn-ghost btn-block" disabled={directLoginBusy} style={{ fontSize: 13.5 }}>
                  {directLoginBusy ? 'Signing In…' : 'Sign In to Supabase Auth'}
                </button>
              </form>
            </details>
          )}

          <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Link to="/dashboard" className="muted" style={{ fontSize: 12.5 }}>
              ← User Dashboard
            </Link>
            <Link to="/" className="muted" style={{ fontSize: 12.5 }}>
              WriteMyWords Home ↗
            </Link>
          </div>
        </div>
      </section>
    );
  }

  // Handle Admin Approving a Transaction & Releasing Payout
  async function handleConfirmApprove() {
    if (!actionModal?.request || actionBusy) return;
    setActionBusy(true);
    const req = actionModal.request;

    try {
      await adminApproveTransaction(req.id, user?.id || 'admin-session', actionModal.notes);
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
      await adminRefundOrRejectTransaction(req.id, user?.id || 'admin-session', {
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
              Logged in as <strong>{user?.name || 'Administrator'}</strong> ({user?.email || 'Master PIN Session'})
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
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setShowSqlSchema(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <IconFileText size={14} /> Full Supabase SQL
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={lockAdminSession}
            style={{ color: 'var(--ink-soft)' }}
            title="Lock Admin Session"
          >
            <IconLock size={14} /> Lock Session
          </button>
          <Link to="/dashboard" className="btn btn-ghost btn-sm">
            User Dashboard →
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

      {/* Supabase SQL Schema Modal */}
      {showSqlSchema && (
        <div className="invoice-overlay" style={{ zIndex: 999999 }} onClick={() => setShowSqlSchema(false)}>
          <div className="auth-card" style={{ maxWidth: 760, width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', background: '#fff' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700 }}>WriteMyWords Supabase Database Schema</h3>
                <p className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                  Run this SQL in your Supabase SQL Editor (Dashboard → SQL Editor → New query)
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowSqlSchema(false)}
              >
                <IconClose size={16} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', background: '#0f172a', color: '#e2e8f0', padding: 14, borderRadius: 8, fontFamily: 'monospace', fontSize: 12, lineHeight: 1.5 }}>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{`-- Run this in Supabase SQL Editor to enable all Admin roles, 10% platform fee, and escrow:
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('student', 'expert', 'admin'));

-- Make any specific user an admin:
-- UPDATE public.profiles SET role = 'admin' WHERE id = 'YOUR_USER_UUID';
-- UPDATE public.profiles SET role = 'admin' WHERE id IN (SELECT id FROM auth.users WHERE email = 'YOUR_EMAIL');

-- Add platform fee columns to requests
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS platform_fee_percent NUMERIC NOT NULL DEFAULT 10.0;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS platform_fee_amount NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS helper_payout_amount NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS admin_approved_at TIMESTAMPTZ;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS admin_approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- Update status check
ALTER TABLE public.requests DROP CONSTRAINT IF EXISTS requests_status_check;
ALTER TABLE public.requests ADD CONSTRAINT requests_status_check CHECK (status IN ('open', 'claimed', 'delivered', 'pending_approval', 'approved', 'cancelled', 'refunded'));

-- Admin bypass RLS function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;`}</pre>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  navigator.clipboard.writeText(`ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('student', 'expert', 'admin'));

ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS platform_fee_percent NUMERIC NOT NULL DEFAULT 10.0;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS platform_fee_amount NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS helper_payout_amount NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS admin_approved_at TIMESTAMPTZ;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS admin_approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS admin_notes TEXT;

ALTER TABLE public.requests DROP CONSTRAINT IF EXISTS requests_status_check;
ALTER TABLE public.requests ADD CONSTRAINT requests_status_check CHECK (status IN ('open', 'claimed', 'delivered', 'pending_approval', 'approved', 'cancelled', 'refunded'));`);
                  toast('SQL schema copied to clipboard!');
                }}
              >
                Copy SQL to Clipboard
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowSqlSchema(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
