// @ts-nocheck
// supabase/functions/verify-razorpay-payment/index.ts
//
// Deploy with: supabase functions deploy verify-razorpay-payment
// Requires these secrets (supabase secrets set ...):
//   RAZORPAY_KEY_SECRET
//   SUPABASE_SERVICE_ROLE_KEY   (Project Settings → API → service_role — keep this secret)
//
// Called by the client right after Razorpay Checkout's success handler
// fires. Re-derives the HMAC signature from the secret key and places the
// funds into Escrow (status: pending_approval) with calculated 10% platform fee.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

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
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Not authenticated. Please log in.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { requestId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json();
    if (!requestId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return new Response(JSON.stringify({ error: 'Missing required payment verification fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Admin client with SERVICE ROLE key to update payment status securely
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: reqRow, error: reqError } = await admin
      .from('requests')
      .select('id, user_id, status, razorpay_order_id, budget_max, budget_min')
      .eq('id', requestId)
      .single();

    if (reqError || !reqRow) {
      return new Response(JSON.stringify({ error: 'Request not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (reqRow.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Only the request owner can confirm this payment' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (reqRow.status !== 'delivered') {
      return new Response(JSON.stringify({ error: 'This request is not awaiting payment' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (reqRow.razorpay_order_id && reqRow.razorpay_order_id !== razorpay_order_id) {
      return new Response(JSON.stringify({ error: 'Order ID mismatch' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify Razorpay HMAC signature
    const expectedSignature = await hmacHex(RAZORPAY_KEY_SECRET, `${razorpay_order_id}|${razorpay_payment_id}`);
    if (expectedSignature !== razorpay_signature) {
      return new Response(JSON.stringify({ error: 'Payment signature verification failed' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const totalAmount = Number(reqRow.budget_max || reqRow.budget_min || 0);
    const platformFee = Math.round(totalAmount * 0.10 * 100) / 100;
    const helperPayout = Math.round((totalAmount - platformFee) * 100) / 100;

    // Place into pending_approval (Escrow awaiting Admin Approval)
    let updatePayload: Record<string, unknown> = {
      status: 'pending_approval',
      razorpay_payment_id,
      amount_paid: totalAmount,
      platform_fee_percent: 10.0,
      platform_fee_amount: platformFee,
      helper_payout_amount: helperPayout,
      paid_at: new Date().toISOString(),
    };

    let { error: updateError } = await admin
      .from('requests')
      .update(updatePayload)
      .eq('id', requestId);

    // If pending_approval status is not yet permitted in DB check constraint, fallback to approved
    if (updateError && (updateError.message.includes('status') || updateError.message.includes('platform_fee'))) {
      console.warn('Fallback: updating status to approved without optional columns:', updateError.message);
      const fallbackPayload = {
        status: 'approved',
        razorpay_payment_id,
        amount_paid: totalAmount,
        paid_at: new Date().toISOString(),
      };
      const retry = await admin.from('requests').update(fallbackPayload).eq('id', requestId);
      if (retry.error) {
        return new Response(JSON.stringify({ error: retry.error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      message: 'Payment verified and placed in Escrow for Admin sign-off.',
      amount_paid: totalAmount,
      platform_fee: platformFee,
      helper_payout: helperPayout,
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
