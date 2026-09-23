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
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name, whatsapp, role } }, // stored on the auth user too, as a convenience
  });
  if (error) throw error;

  // Only write the profile row if we already have a session (i.e. email
  // confirmation is off, or was already satisfied) — RLS requires
  // auth.uid() = id, so this insert fails harmlessly otherwise and the
  // profile gets created on first login instead (see ensureProfile below).
  if (data.session) {
    await supabase.from('profiles').upsert({ id: data.user.id, name, whatsapp, role });
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

// Makes sure a profile row exists for the signed-in user (covers the case
// where email confirmation delayed the original profile insert in signUpUser).
export async function ensureProfile(authUser) {
  if (!supabase || !authUser) return null;
  const { data: existing } = await supabase.from('profiles').select('*').eq('id', authUser.id).maybeSingle();
  if (existing) return existing;
  const meta = authUser.user_metadata || {};
  const { data, error } = await supabase
    .from('profiles')
    .upsert({ id: authUser.id, name: meta.name || '', whatsapp: meta.whatsapp || '', role: meta.role || 'student' })
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

// Helper claims an open request. The trigger in writemywords_schema.sql
// rejects this if it's already claimed by someone else.
export async function claimRequest(id, helperId, helperName) {
  if (!supabase) return null;
  const updateData = { helper_id: helperId, status: 'claimed' };
  if (helperName) updateData.helper_name = cleanText(helperName, 100);

  let { data, error } = await supabase
    .from('requests')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  // If the database schema has not been updated with helper_name yet, retry without helper_name
  if (error && error.message && (error.message.includes('helper_name') || error.message.includes('schema cache'))) {
    console.warn('helper_name column not found in schema cache, retrying without helper_name...');
    const retry = await supabase
      .from('requests')
      .update({ helper_id: helperId, status: 'claimed' })
      .eq('id', id)
      .select()
      .single();
    if (retry.error) {
      console.warn('claimRequest fallback failed', retry.error);
      throw retry.error;
    }
    return retry.data;
  }

  if (error) { console.warn('claimRequest failed', error); throw error; }
  return data;
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
// without refreshing. No-ops (returns a no-op unsubscribe) if Supabase isn't configured.
export function subscribeToMessages(requestId, onInsert) {
  if (!supabase) return () => {};
  const channel = supabase
    .channel(`messages:${requestId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `request_id=eq.${requestId}` },
      (payload) => onInsert(payload.new))
    .subscribe();
  return () => supabase.removeChannel(channel);
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

