import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  claimRequest, ensureProfile, fetchMyRequests, fetchOpenRequests, getProfile, getSession,
  insertRequest, onAuthChange, signInUser, signOutUser, signUpUser, submitDelivery, supabase,
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
  const [authLoading, setAuthLoading] = useState(!!supabase);
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
      if (s?.user) setProfile(await getProfile(s.user.id));
      setAuthLoading(false);
    });
    const unsubscribe = onAuthChange(async (s) => {
      setSession(s);
      if (s?.user) setProfile(await ensureProfile(s.user));
      else setProfile(null);
    });
    return () => { cancelled = true; unsubscribe(); };
  }, []);

  const refreshBoard = useCallback(async () => {
    const rows = await fetchOpenRequests();
    if (rows && rows.length) setRequests(rows);
  }, []);

  const refreshMine = useCallback(async () => {
    if (!session?.user) { setMyRequests([]); return; }
    setMyRequests(await fetchMyRequests(session.user.id));
  }, [session]);

  useEffect(() => { refreshBoard(); }, [refreshBoard]);
  useEffect(() => { refreshMine(); }, [refreshMine]);

  const user = session?.user
    ? {
        id: session.user.id,
        email: session.user.email,
        name: profile?.name || session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
        whatsapp: profile?.whatsapp || session.user.user_metadata?.whatsapp || '',
        role: profile?.role || session.user.user_metadata?.role || 'student',
        ...profile,
      }
    : null;

  const signup = useCallback(async ({ name, email, whatsapp, role, password }) => {
    const data = await signUpUser({ name, email, whatsapp, role, password });
    if (!data.session) return { needsConfirmation: true };
    setSession(data.session);
    const p = await getProfile(data.user.id);
    if (p) setProfile(p);
    return { needsConfirmation: false };
  }, []);

  const login = useCallback(async ({ email, password }) => {
    const data = await signInUser({ email, password });
    setSession(data.session);
    if (data.user) {
      const p = await getProfile(data.user.id);
      if (p) setProfile(p);
    }
  }, []);

  const logout = useCallback(async () => {
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

  const claim = useCallback(async (requestId) => {
    if (!session?.user) throw new Error('You need to be signed in to help.');
    const row = await claimRequest(requestId, session.user.id);
    await refreshMine(); await refreshBoard();
    return row;
  }, [session, refreshMine, refreshBoard]);

  const deliver = useCallback(async (requestId, text) => {
    const row = await submitDelivery(requestId, text);
    await refreshMine();
    return row;
  }, [refreshMine]);

  return (
    <AppContext.Provider value={{
      user, session, authLoading, requests, myRequests,
      signup, login, logout, postRequest, claim, deliver, refreshMine, refreshBoard, toast,
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
