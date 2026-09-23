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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID') || '';
const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Verify caller authentication
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Not authenticated. Please log in.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { requestId } = await req.json();
    if (!requestId) {
      return new Response(JSON.stringify({ error: 'requestId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Load request from DB and verify ownership & status
    const { data: reqRow, error: reqError } = await supabase
      .from('requests')
      .select('id, user_id, status, budget_max, title')
      .eq('id', requestId)
      .single();

    if (reqError || !reqRow) {
      return new Response(JSON.stringify({ error: 'Request not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (reqRow.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Only the request owner can pay for it' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (reqRow.status !== 'delivered') {
      return new Response(JSON.stringify({ error: 'This request is not in delivered status yet' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const amountPaise = Math.round(Number(reqRow.budget_max) * 100);
    if (amountPaise <= 0) {
      return new Response(JSON.stringify({ error: 'Invalid budget amount' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Razorpay order
    const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`),
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: 'INR',
        receipt: `rcpt_${requestId.toString().slice(0, 20)}`,
        notes: { request_id: String(requestId), user_id: String(user.id) },
      }),
    });

    if (!orderRes.ok) {
      const errText = await orderRes.text();
      return new Response(JSON.stringify({ error: 'Razorpay order creation failed', detail: errText }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const order = await orderRes.json();

    // Stash the order id in the request row
    await supabase.from('requests').update({ razorpay_order_id: order.id }).eq('id', requestId);

    return new Response(JSON.stringify({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: RAZORPAY_KEY_ID,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
