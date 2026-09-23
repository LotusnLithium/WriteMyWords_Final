// supabase/functions/verify-razorpay-payment/index.ts
//
// Deploy with: supabase functions deploy verify-razorpay-payment
// Requires these secrets (supabase secrets set ...):
//   RAZORPAY_KEY_SECRET
//   SUPABASE_SERVICE_ROLE_KEY   (Project Settings → API → service_role — keep this secret)
//
// Called by the client right after Razorpay Checkout's success handler
// fires. Re-derives the HMAC signature from the secret key and only marks
// the request approved/paid if it matches — the client's word alone is
// never enough to release payment.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401 });
    }

    const { requestId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json();
    if (!requestId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return new Response(JSON.stringify({ error: 'Missing payment fields' }), { status: 400 });
    }

    // This client uses the SERVICE ROLE key — it bypasses RLS, so every
    // check below is load-bearing. Never skip a check to "simplify" this.
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: reqRow, error: reqError } = await admin
      .from('requests')
      .select('id, user_id, status, razorpay_order_id, budget_max')
      .eq('id', requestId)
      .single();
    if (reqError || !reqRow) {
      return new Response(JSON.stringify({ error: 'Request not found' }), { status: 404 });
    }
    if (reqRow.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Only the request owner can confirm this payment' }), { status: 403 });
    }
    if (reqRow.status !== 'delivered') {
      return new Response(JSON.stringify({ error: 'This request is not awaiting payment' }), { status: 400 });
    }
    if (reqRow.razorpay_order_id !== razorpay_order_id) {
      return new Response(JSON.stringify({ error: 'Order id mismatch' }), { status: 400 });
    }

    // Razorpay's documented verification: HMAC-SHA256(order_id + "|" + payment_id, key_secret)
    const expectedSignature = await hmacHex(RAZORPAY_KEY_SECRET, `${razorpay_order_id}|${razorpay_payment_id}`);
    if (expectedSignature !== razorpay_signature) {
      return new Response(JSON.stringify({ error: 'Payment signature verification failed' }), { status: 400 });
    }

    const { error: updateError } = await admin
      .from('requests')
      .update({
        status: 'approved',
        razorpay_payment_id,
        amount_paid: reqRow.budget_max,
        paid_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
