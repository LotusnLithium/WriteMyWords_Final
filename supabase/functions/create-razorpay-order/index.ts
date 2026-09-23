// supabase/functions/create-razorpay-order/index.ts
//
// Deploy with: supabase functions deploy create-razorpay-order
// Requires these secrets (supabase secrets set ...):
//   RAZORPAY_KEY_ID
//   RAZORPAY_KEY_SECRET
//
// Called by the client right before opening Razorpay Checkout. Creates
// the order using your secret key (which never reaches the browser) and
// returns just the order id + amount the client needs to open Checkout.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID')!;
const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    // Verify the caller is a real, signed-in user (not a bare fetch from
    // anywhere) before creating a payable order on their behalf.
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401 });
    }

    const { requestId } = await req.json();
    if (!requestId) {
      return new Response(JSON.stringify({ error: 'requestId is required' }), { status: 400 });
    }

    // Load the request and confirm THIS user is the poster, the request is
    // actually in "delivered" state, and pull the amount from the DB —
    // never trust an amount sent by the client.
    const { data: reqRow, error: reqError } = await supabase
      .from('requests')
      .select('id, user_id, status, budget_max')
      .eq('id', requestId)
      .single();

    if (reqError || !reqRow) {
      return new Response(JSON.stringify({ error: 'Request not found' }), { status: 404 });
    }
    if (reqRow.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Only the request owner can pay for it' }), { status: 403 });
    }
    if (reqRow.status !== 'delivered') {
      return new Response(JSON.stringify({ error: 'This request is not ready for payment yet' }), { status: 400 });
    }

    const amountPaise = Math.round(Number(reqRow.budget_max) * 100); // Razorpay wants the smallest currency unit

    const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`),
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: 'INR',
        receipt: requestId,
        notes: { request_id: requestId, user_id: user.id },
      }),
    });

    if (!orderRes.ok) {
      const errText = await orderRes.text();
      return new Response(JSON.stringify({ error: 'Razorpay order creation failed', detail: errText }), { status: 502 });
    }

    const order = await orderRes.json();

    // Stash the order id so verify-razorpay-payment can cross-check it later.
    await supabase.from('requests').update({ razorpay_order_id: order.id }).eq('id', requestId);

    return new Response(JSON.stringify({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: RAZORPAY_KEY_ID, // the publishable key id — safe to expose, needed by Checkout.js
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
