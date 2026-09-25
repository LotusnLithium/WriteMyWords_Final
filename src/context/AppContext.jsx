import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  cancelRequest, checkIsAdmin, claimRequest, ensureProfile, fetchMyRequests, fetchOpenRequests, getProfile, getSession,
  insertRequest, onAuthChange, signInUser, signOutUser, signUpUser, submitDelivery, supabase, updateRequest,
} from '../lib/supabaseClient';

const AppContext = createContext(null);

const seedRequests = [
  { id: 'r1', title: 'Need help structuring a Marketing Research project', category: 'Research', subject: 'Research', academic_level: 'Undergraduate', budget_min: 800, budget_max: 1500, deadline: '3 days' },
  { id: 'r2', title: 'Proofread a 12-page sociology literature review', category: 'Proofreading', subject: 'Proofreading', academic_level: 'Postgraduate', budget_min: 600, budget_max: 1000, deadline: '5 days' },
  { id: 'r3', title: 'Guidance formatting citations for a business report', category: 'Formatting', subject: 'Formatting', academic_level: 'Undergraduate', budget_min: 400, budget_max: 700, deadline: '2 days' },
];

export function AppProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null); // { id, name, whatsapp, role }
  const [ownerSession, setOwnerSession] = useState(() => {
    try {
      const saved = localStorage.getItem('wmw_owner_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (checkIsAdmin(parsed.email)) return parsed;
      }
    } catch (_) {}
    return null;
  });
  const [authLoading, setAuthLoading] = useState(true);
  const [requests, setRequests] = useState(seedRequests);   // public board (open only)
  const [myRequests, setMyRequests] = useState([]);         // everything I posted or am helping with
  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);

  const toast = useCallback((message) => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2600);
  }, []);

  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return; }
    let cancelled = false;
    getSession().then(async (s) => {
      if (cancelled) return;
      setSession(s);
      if (s?.user) {
        setProfile(await getProfile(s.user.id));
        if (checkIsAdmin(s.user.email)) {
          const ownerObj = {
            id: s.user.id,
            email: s.user.email,
            name: s.user.user_metadata?.name || s.user.email.split('@')[0],
            role: 'admin',
          };
          try { localStorage.setItem('wmw_owner_session', JSON.stringify(ownerObj)); } catch (_) {}
          setOwnerSession(ownerObj);
        }
      }
      setAuthLoading(false);
    }).catch(() => {
      if (!cancelled) setAuthLoading(false);
    });
    const unsubscribe = onAuthChange(async (s) => {
      setSession(s);
      if (s?.user) {
        const p = await ensureProfile(s.user);
        setProfile(p);
        if (checkIsAdmin(s.user.email)) {
          const ownerObj = {
            id: s.user.id,
            email: s.user.email,
            name: p?.name || s.user.user_metadata?.name || s.user.email.split('@')[0],
            role: 'admin',
          };
          try { localStorage.setItem('wmw_owner_session', JSON.stringify(ownerObj)); } catch (_) {}
          setOwnerSession(ownerObj);
        }
      } else {
        setProfile(null);
      }
    });
    return () => { cancelled = true; unsubscribe(); };
  }, []);

  const refreshBoard = useCallback(async () => {
    const rows = await fetchOpenRequests();
    if (rows && rows.length) setRequests(rows);
  }, []);

  const refreshMine = useCallback(async () => {
    const currentUserId = session?.user?.id || ownerSession?.id;
    if (!currentUserId) { setMyRequests([]); return; }
    setMyRequests(await fetchMyRequests(currentUserId));
  }, [session, ownerSession]);

  useEffect(() => { refreshBoard(); }, [refreshBoard]);
  useEffect(() => { refreshMine(); }, [refreshMine]);

  const isOwnerAdmin = session?.user?.email
    ? checkIsAdmin(session.user.email)
    : (ownerSession ? checkIsAdmin(ownerSession.email) : false);

  const user = session?.user
    ? {
        id: session.user.id,
        email: session.user.email,
        name: profile?.name || session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
        whatsapp: profile?.whatsapp || session.user.user_metadata?.whatsapp || '',
        ...profile,
        role: isOwnerAdmin ? 'admin' : (profile?.role || session.user.user_metadata?.role || 'student'),
      }
    : (ownerSession && checkIsAdmin(ownerSession.email))
    ? {
        id: ownerSession.id || 'usr-owner-admin',
        email: ownerSession.email,
        name: ownerSession.name || (ownerSession.email.includes('varun') ? 'Varun Suthar (Owner)' : 'Vighram (Owner)'),
        whatsapp: ownerSession.whatsapp || '',
        role: 'admin',
      }
    : null;

  const loginAsOwner = useCallback((ownerEmail) => {
    const clean = (ownerEmail || '').toLowerCase().trim();
    if (checkIsAdmin(clean)) {
      const ownerObj = {
        id: clean.includes('varun') ? 'owner-varun-01' : 'owner-vighram-02',
        email: clean,
        name: clean.includes('varun') ? 'Varun Suthar (Owner)' : 'Vighram (Owner)',
        whatsapp: '',
        role: 'admin',
      };
      try {
        localStorage.setItem('wmw_owner_session', JSON.stringify(ownerObj));
      } catch (_) {}
      setOwnerSession(ownerObj);
      return true;
    }
    return false;
  }, []);

  const signup = useCallback(async ({ name, email, whatsapp, role, password }) => {
    const data = await signUpUser({ name, email, whatsapp, role, password });
    if (!data.session) return { needsConfirmation: true };
    setSession(data.session);
    const p = await getProfile(data.user.id);
    if (p) setProfile(p);
    if (checkIsAdmin(email)) {
      loginAsOwner(email);
    }
    return { needsConfirmation: false };
  }, [loginAsOwner]);

  const login = useCallback(async ({ email, password }) => {
    const data = await signInUser({ email, password });
    setSession(data.session);
    if (data.user) {
      const p = await getProfile(data.user.id);
      if (p) setProfile(p);
      if (checkIsAdmin(data.user.email)) {
        loginAsOwner(data.user.email);
      }
    }
  }, [loginAsOwner]);

  const logout = useCallback(async () => {
    try {
      localStorage.removeItem('wmw_owner_session');
    } catch (_) {}
    setOwnerSession(null);
    await signOutUser();
    setSession(null);
    setProfile(null);
  }, []);

  const postRequest = useCallback(async (data) => {
    if (!session?.user) throw new Error('You need to be signed in to post a request.');
    const row = await insertRequest(data, session.user.id);
    if (row) { await refreshMine(); await refreshBoard(); }
    return row;
  }, [session, refreshMine, refreshBoard]);

  const editRequest = useCallback(async (requestId, data) => {
    if (!session?.user) throw new Error('You need to be signed in to edit a request.');
    const row = await updateRequest(requestId, data);
    await refreshMine(); await refreshBoard();
    return row;
  }, [session, refreshMine, refreshBoard]);

  const cancelMyRequest = useCallback(async (requestId) => {
    if (!session?.user) throw new Error('You need to be signed in.');
    const row = await cancelRequest(requestId);
    await refreshMine(); await refreshBoard();
    return row;
  }, [session, refreshMine, refreshBoard]);

  const claim = useCallback(async (requestId) => {
    if (!session?.user) throw new Error('You need to be signed in to help.');
    const helperName = user?.name || session.user?.user_metadata?.name || 'Expert';
    const row = await claimRequest(requestId, session.user.id, helperName);
    await refreshMine(); await refreshBoard();
    return row;
  }, [session, user, refreshMine, refreshBoard]);

  const deliver = useCallback(async (requestId, payload) => {
    const row = await submitDelivery(requestId, payload);
    await refreshMine();
    return row;
  }, [refreshMine]);

  return (
    <AppContext.Provider value={{
      user, session, authLoading, requests, myRequests,
      signup, login, loginAsOwner, logout, postRequest, editRequest, cancelMyRequest, claim, deliver, refreshMine, refreshBoard, toast,
    }}>
      {children}
      <div id="toast-host">
        {toasts.map((t) => <div key={t.id} className="toast">{t.message}</div>)}
      </div>
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
