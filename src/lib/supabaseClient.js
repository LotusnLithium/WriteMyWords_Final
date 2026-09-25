import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL || 'https://xjdkqgzvtttlqctljhsw.supabase.co';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_YhFw4UHVQgS5ex4kdUFrfQ_N-eyh-ZA';

// Initializes the Supabase client using environment variables or production defaults
export const supabase = url && anonKey
  ? createClient(url, anonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null;


/* ---------------- admin configuration ---------------- */
export const ADMIN_EMAILS = [
  'varunsuthararts11@gmail.com',
  'vighram17@gmail.com',
];

export function checkIsAdmin(userOrEmail) {
  if (!userOrEmail) return false;
  let email = '';
  let role = '';
  if (typeof userOrEmail === 'string') {
    email = userOrEmail.toLowerCase().trim();
  } else {
    email = (userOrEmail.email || '').toLowerCase().trim();
    role = (userOrEmail.role || '').toLowerCase().trim();
  }
  if (ADMIN_EMAILS.includes(email)) return true;
  if (role === 'admin' && ADMIN_EMAILS.includes(email)) return true;
  return false;
}

/* ---------------- validation ---------------- */
// Deliberately conservative: reject anything that isn't a plausible email/
// phone/short text, and cap lengths so a malicious or buggy client can't
// push oversized payloads into the database (defense in depth alongside the
// DB-level check constraints in writemywords_schema.sql).
export function isValidEmail(v) {
  return /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/.test((v || '').trim());
}
export function isValidWhatsapp(v) {
  const digits = (v || '').replace(/[^\d+]/g, '');
  return /^\+?[0-9]{7,16}$/.test(digits);
}
export function isStrongPassword(v) {
  return typeof v === 'string' && v.length >= 6;
}
export function cleanText(v, maxLen = 2000) {
  return (v || '').toString().trim().slice(0, maxLen);
}

/* ---------------- auth ---------------- */
// Creates a real Supabase Auth account (email + password) and a matching
// profile row. If your project has email confirmation enabled (recommended),
// `data.session` will be null until the user clicks the confirmation link —
// the caller should handle that case (see Signup.jsx).
export async function signUpUser({ name, email, whatsapp, role, password }) {
  if (!supabase) throw new Error('Supabase is not configured yet.');
  const targetRole = checkIsAdmin(email) ? 'admin' : (role || 'student');
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name, whatsapp, role: targetRole } },
  });
  if (error) throw error;

  if (data.session) {
    await supabase.from('profiles').upsert({ id: data.user.id, name, whatsapp, role: targetRole });
  }
  return data;
}

export async function signInUser({ email, password }) {
  if (!supabase) throw new Error('Supabase is not configured yet.');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  await ensureProfile(data.user);
  return data;
}

export async function signOutUser() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export function onAuthChange(callback) {
  if (!supabase) return () => {};
  const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => sub.subscription.unsubscribe();
}

export async function getSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// Makes sure a profile row exists for the signed-in user and elevates owner emails to admin
export async function ensureProfile(authUser) {
  if (!supabase || !authUser) return null;
  const isOwnerAdmin = checkIsAdmin(authUser.email);
  const meta = authUser.user_metadata || {};
  const targetRole = isOwnerAdmin ? 'admin' : (meta.role || 'student');

  const { data: existing } = await supabase.from('profiles').select('*').eq('id', authUser.id).maybeSingle();
  if (existing) {
    if (isOwnerAdmin && existing.role !== 'admin') {
      const { data: updated } = await supabase.from('profiles').update({ role: 'admin' }).eq('id', authUser.id).select().maybeSingle();
      return updated || { ...existing, role: 'admin' };
    }
    return existing;
  }

  const { data, error } = await supabase
    .from('profiles')
    .upsert({ id: authUser.id, name: meta.name || '', whatsapp: meta.whatsapp || '', role: targetRole })
    .select()
    .single();
  if (error) { console.warn('ensureProfile failed', error); return null; }
  return data;
}

export async function getProfile(userId) {
  if (!supabase) return null;
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) { console.warn('getProfile failed', error); return null; }
  return data;
}

/* ---------------- requests: workflow ---------------- */
// Owner-scoped insert: RLS requires user_id = auth.uid(), so this only
// succeeds when called by the signed-in student themselves.
export async function insertRequest(row, userId) {
  if (!supabase) { console.warn('Supabase not configured — request not saved:', row); return null; }
  let { data, error } = await supabase.from('requests').insert([{ ...row, user_id: userId }]).select().single();
  
  if (error && error.message && (error.message.includes('requester_name') || error.message.includes('attachment_') || error.message.includes('schema cache'))) {
    console.warn('Retrying insertRequest without optional columns due to schema cache:', error.message);
    const fallbackRow = { ...row };
    delete fallbackRow.requester_name;
    delete fallbackRow.attachment_url;
    delete fallbackRow.attachment_name;
    const retry = await supabase.from('requests').insert([{ ...fallbackRow, user_id: userId }]).select().single();
    if (retry.error) {
      console.warn('insertRequest fallback failed', retry.error);
      throw retry.error;
    }
    return retry.data;
  }
  
  if (error) { console.warn('insertRequest failed', error); throw error; }
  return data;
}

// A signed-in user's own involvement — everything they posted OR are
// helping with (RLS lets participants read their own rows).
export async function fetchMyRequests(userId) {
  if (!supabase || !userId) return [];
  const { data, error } = await supabase
    .from('requests')
    .select('*')
    .or(`user_id.eq.${userId},helper_id.eq.${userId}`)
    .order('created_at', { ascending: false });
  if (error) { console.warn('fetchMyRequests failed', error); return []; }
  return data || [];
}

// The public board — open requests only, no contact info (via the
// requests_public VIEW, which is also filtered to status = 'open').
export async function fetchOpenRequests() {
  if (!supabase) return [];
  const { data, error } = await supabase.from('requests_public').select('*').order('created_at', { ascending: false });
  if (error) { console.warn('fetchOpenRequests failed', error); return []; }
  return data || [];
}

// A single request a participant is allowed to see in full (RLS-checked).
export async function fetchRequestById(id) {
  if (!supabase) return null;
  const { data, error } = await supabase.from('requests').select('*').eq('id', id).maybeSingle();
  if (error) { console.warn('fetchRequestById failed', error); return null; }
  return data;
}

/* ---------------- budget ranges ---------------- */
export const BUDGET_RANGES = [
  { label: '₹0 – ₹50', min: 0, max: 50 },
  { label: '₹50 – ₹100', min: 50, max: 100 },
  { label: '₹100 – ₹250', min: 100, max: 250 },
  { label: '₹250 – ₹500', min: 250, max: 500 },
  { label: '₹500 – ₹750', min: 500, max: 750 },
  { label: '₹750 – ₹1,000', min: 750, max: 1000 },
  { label: '₹1,000 – ₹1,500', min: 1000, max: 1500 },
  { label: '₹1,500 – ₹2,500', min: 1500, max: 2500 },
  { label: '₹2,500 – ₹5,000', min: 2500, max: 5000 },
  { label: '₹5,000+', min: 5000, max: 10000 },
];

export function getBudgetLabel(min, max) {
  if (min === max && min > 0) return `₹${min}`;
  if (!min && !max) return '₹500 – ₹1000';
  const found = BUDGET_RANGES.find((r) => r.min === Number(min) && r.max === Number(max));
  if (found) return found.label;
  if (min && !max) return `₹${min}+`;
  return `₹${min} – ₹${max}`;
}

// Update an existing request (for student owner editing)
export async function updateRequest(id, payload) {
  if (!supabase) return null;
  const updateData = { ...payload, updated_at: new Date().toISOString() };
  
  let { data, error } = await supabase
    .from('requests')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error && (error.message.includes('schema cache') || error.message.includes('column'))) {
    console.warn('updateRequest schema fallback:', error.message);
    const fallbackData = { ...payload };
    delete fallbackData.finalized_price;
    delete fallbackData.price_approved;
    const retry = await supabase.from('requests').update(fallbackData).eq('id', id).select().single();
    if (retry.error) throw retry.error;
    return retry.data;
  }

  if (error) throw error;
  return data;
}

// Cancel or remove an open request
export async function cancelRequest(id) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('requests')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Helper claims an open request (Ultra resilient against schema cache)
export async function claimRequest(id, helperId, helperName) {
  if (!supabase) return null;

  try {
    const updateData = { helper_id: helperId, status: 'claimed' };
    if (helperName) updateData.helper_name = cleanText(helperName, 100);

    const { data, error } = await supabase
      .from('requests')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (!error && data) return data;
  } catch (err) {
    console.warn('claimRequest first attempt note:', err);
  }

  // Fallback 1: Retry without helper_name column
  try {
    const { data, error } = await supabase
      .from('requests')
      .update({ helper_id: helperId, status: 'claimed' })
      .eq('id', id)
      .select()
      .single();

    if (!error && data) return data;
  } catch (err) {
    console.warn('claimRequest fallback 1 note:', err);
  }

  // Fallback 2: Execute raw update without .single() selection
  const { error: finalError } = await supabase
    .from('requests')
    .update({ helper_id: helperId, status: 'claimed' })
    .eq('id', id);

  if (finalError) {
    console.warn('claimRequest final error:', finalError);
    throw new Error(finalError.message || 'Could not claim assignment.');
  }

  return { id, helper_id: helperId, helper_name: helperName, status: 'claimed' };
}

// Upload document/attachment to Supabase Storage
export async function uploadAttachment(file, folder = 'documents') {
  if (!supabase || !file) return null;
  const safeName = (file.name || 'document').replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = `${folder}/${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${safeName}`;
  
  const { data, error } = await supabase.storage
    .from('request_attachments')
    .upload(filePath, file, { cacheControl: '3600', upsert: true });

  if (error) {
    console.warn('Storage upload error:', error);
    throw new Error(error.message || 'Failed to upload document.');
  }

  const { data: urlData } = supabase.storage
    .from('request_attachments')
    .getPublicUrl(filePath);

  return {
    url: urlData?.publicUrl || '',
    name: file.name,
    size: file.size,
  };
}

// Helper submits their guidance/feedback + optional Word document / file
export async function submitDelivery(id, payload) {
  if (!supabase) return null;
  const updateData = typeof payload === 'string'
    ? { delivery_text: cleanText(payload, 4000), status: 'delivered' }
    : {
        delivery_text: cleanText(payload.deliveryText || '', 4000),
        delivery_file_url: payload.deliveryFileUrl || null,
        delivery_file_name: payload.deliveryFileName || null,
        status: 'delivered',
      };

  let { data, error } = await supabase
    .from('requests')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  // If delivery_file columns don't exist yet, retry with delivery_text only
  if (error && error.message && (error.message.includes('delivery_file') || error.message.includes('schema cache'))) {
    console.warn('delivery_file columns missing in schema cache, falling back to delivery_text...');
    const retry = await supabase
      .from('requests')
      .update({
        delivery_text: typeof payload === 'string' ? cleanText(payload, 4000) : cleanText(payload.deliveryText || '', 4000),
        status: 'delivered',
      })
      .eq('id', id)
      .select()
      .single();
    if (retry.error) {
      console.warn('submitDelivery fallback failed', retry.error);
      throw retry.error;
    }
    return retry.data;
  }

  if (error) { console.warn('submitDelivery failed', error); throw error; }
  return data;
}

/* ---------------- messages ---------------- */
export async function fetchMessages(requestId) {
  if (!supabase) return [];
  const { data, error } = await supabase.from('messages').select('*').eq('request_id', requestId).order('created_at', { ascending: true });
  if (error) { console.warn('fetchMessages failed', error); return []; }
  return data || [];
}

export async function sendMessage(requestId, senderId, body) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('messages')
    .insert([{ request_id: requestId, sender_id: senderId, body: cleanText(body, 2000) }])
    .select()
    .single();
  if (error) { console.warn('sendMessage failed', error); throw error; }
  return data;
}

// Live-updates the thread as new messages arrive, so both sides see replies
// without refreshing.
export function subscribeToMessages(requestId, onInsert) {
  if (!supabase) return () => {};
  const channel = supabase
    .channel(`realtime:messages:${requestId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `request_id=eq.${requestId}`,
      },
      (payload) => {
        if (payload?.new) {
          onInsert(payload.new);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/* ---------------- payments (Razorpay, via Edge Functions) ----------------
   The two Edge Functions in /supabase/functions do the actual money-moving
   logic server-side (see their source for why). These helpers just call them. */
async function callEdgeFunction(name, body) {
  if (!supabase) throw new Error('Supabase is not configured yet. Please add your Supabase credentials in .env.');
  
  // Prefer official Supabase SDK functions.invoke
  try {
    const { data, error } = await supabase.functions.invoke(name, { body });
    if (error) {
      let errMsg = error.message;
      if (error.context && typeof error.context.json === 'function') {
        try {
          const errBody = await error.context.json();
          if (errBody?.error) errMsg = errBody.error;
        } catch (_) {}
      }
      throw new Error(errMsg || `Function ${name} returned an error.`);
    }
    return data;
  } catch (err) {
    // Fallback to direct fetch if invoke encountered a network problem
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('You need to be signed in to perform this action.');
    const res = await fetch(`${url}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        apikey: anonKey,
      },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || err.message || 'Something went wrong.');
    return json;
  }
}

export function createRazorpayOrder(requestId) {
  return callEdgeFunction('create-razorpay-order', { requestId });
}
export function verifyRazorpayPayment(payload) {
  return callEdgeFunction('verify-razorpay-payment', payload);
}

// Opens Razorpay's Checkout widget (loaded via the <script> tag in
// index.html) using an order created by the Edge Function above, and
// verifies the result through the second Edge Function before treating
// the request as paid/approved.
export function openRazorpayCheckout({ order, request, onSuccess, onError }) {
  if (!window.Razorpay) {
    onError?.(new Error('Razorpay Checkout SDK failed to load. Please check your internet connection and reload.'));
    return;
  }
  const key = order.keyId || import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_live_TXtE3B6LLxUhCL';
  if (!key) {
    onError?.(new Error('Razorpay Key ID is missing. Please set RAZORPAY_KEY_ID in Supabase secrets or .env.'));
    return;
  }
  const rzp = new window.Razorpay({
    key,
    amount: order.amount,
    currency: order.currency || 'INR',
    order_id: order.orderId,
    name: 'WriteMyWords',
    description: request.title || 'Assignment Guidance',
    handler: async (response) => {
      try {
        await verifyRazorpayPayment({
          requestId: request.id,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
        });
        onSuccess?.();
      } catch (err) {
        onError?.(err);
      }
    },
    modal: { ondismiss: () => onError?.(new Error('Payment window closed.')) },
    theme: { color: '#12142B' },
  });
  rzp.on('payment.failed', (resp) => onError?.(new Error(resp.error?.description || 'Payment failed.')));
  rzp.open();
}

/* ---------------- admin operations ---------------- */

// Fetch all platform requests across all statuses for Admin operations
export async function fetchAdminAllRequests() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('fetchAdminAllRequests failed:', error);
    return [];
  }
  return data || [];
}

// Fetch all registered user profiles for Admin management
export async function fetchAdminAllUsers() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('fetchAdminAllUsers failed:', error);
    return [];
  }
  return data || [];
}

// Admin finalizes and approves the price for a student assignment
export async function adminFinalizePrice(requestId, finalizedAmount, adminId, notes = '') {
  if (!supabase) throw new Error('Supabase is not configured.');

  const price = Math.max(0, Number(finalizedAmount) || 0);
  const platformFee = Math.round(price * 0.20 * 100) / 100;
  const helperPayout = Math.round(price * 0.80 * 100) / 100;

  const updateData = {
    finalized_price: price,
    price_approved: true,
    amount_paid: price,
    budget_max: price,
    budget_min: price,
    platform_fee_percent: 20.0,
    platform_fee_amount: platformFee,
    helper_payout_amount: helperPayout,
    admin_notes: notes ? cleanText(notes, 500) : 'Price finalized by Admin',
    updated_at: new Date().toISOString(),
  };
  if (adminId) updateData.admin_approved_by = adminId;

  let { data, error } = await supabase
    .from('requests')
    .update(updateData)
    .eq('id', requestId)
    .select()
    .single();

  if (error && (error.message.includes('finalized_price') || error.message.includes('schema cache'))) {
    console.warn('adminFinalizePrice schema fallback:', error.message);
    const retry = await supabase
      .from('requests')
      .update({ budget_max: price, budget_min: price, amount_paid: price })
      .eq('id', requestId)
      .select()
      .single();
    if (retry.error) throw retry.error;
    return { ...retry.data, finalized_price: price, price_approved: true, helper_payout_amount: helperPayout };
  }

  if (error) throw error;
  return data;
}

// Admin approves an escrow transaction, marking task completed and authorizing 80% helper payout
export async function adminApproveTransaction(requestId, adminId, notes = '') {
  if (!supabase) throw new Error('Supabase is not configured.');

  // Fetch current request data to ensure fee calculation
  const { data: currentReq } = await supabase
    .from('requests')
    .select('amount_paid, finalized_price, budget_max, budget_min')
    .eq('id', requestId)
    .single();

  const totalAmount = Number(currentReq?.finalized_price || currentReq?.amount_paid || currentReq?.budget_max || currentReq?.budget_min || 0);
  const platformFee = Math.round(totalAmount * 0.20 * 100) / 100;
  const helperPayout = Math.round(totalAmount * 0.80 * 100) / 100;

  const updateData = {
    status: 'approved',
    finalized_price: totalAmount,
    price_approved: true,
    amount_paid: totalAmount,
    platform_fee_percent: 20.0,
    platform_fee_amount: platformFee,
    helper_payout_amount: helperPayout,
    admin_approved_at: new Date().toISOString(),
    admin_notes: notes || 'Approved & Settled by Admin',
  };
  if (adminId) updateData.admin_approved_by = adminId;

  let { data, error } = await supabase
    .from('requests')
    .update(updateData)
    .eq('id', requestId)
    .select()
    .single();

  // Retry fallback without optional admin columns if schema hasn't reloaded yet
  if (error && (error.message.includes('admin_') || error.message.includes('platform_fee') || error.message.includes('schema cache'))) {
    console.warn('Retrying admin approval without optional columns:', error.message);
    const retry = await supabase
      .from('requests')
      .update({ status: 'approved', amount_paid: totalAmount })
      .eq('id', requestId)
      .select()
      .single();

    if (retry.error) throw retry.error;
    return retry.data;
  }

  if (error) throw error;
  return data;
}

// Admin rejects or refunds a transaction
export async function adminRefundOrRejectTransaction(requestId, adminId, { action = 'refunded', reason = '' }) {
  if (!supabase) throw new Error('Supabase is not configured.');

  const updateData = {
    status: action === 'cancel' ? 'cancelled' : 'refunded',
    admin_notes: reason || (action === 'cancel' ? 'Cancelled by Admin' : 'Refunded by Admin'),
  };
  if (adminId) updateData.admin_approved_by = adminId;

  let { data, error } = await supabase
    .from('requests')
    .update(updateData)
    .eq('id', requestId)
    .select()
    .single();

  if (error && (error.message.includes('admin_') || error.message.includes('schema cache'))) {
    const retry = await supabase
      .from('requests')
      .update({ status: action === 'cancel' ? 'cancelled' : 'refunded' })
      .eq('id', requestId)
      .select()
      .single();

    if (retry.error) throw retry.error;
    return retry.data;
  }

  if (error) throw error;
  return data;
}

// Admin updates a user's role
export async function adminUpdateUserRole(userId, newRole) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase
    .from('profiles')
    .update({ role: newRole, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}


