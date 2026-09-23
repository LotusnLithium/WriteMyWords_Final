# WriteMyWords — Post & Help, with Razorpay payments

Two things you can do with one account: **post an assignment you need help
with**, or **help with someone else's**. A poster pays only after they
approve what a helper delivered.

## Important: what "help" means here

The helper's deliverable is **guidance, feedback, or an edited/annotated
excerpt** — not a finished, submit-ready assignment. This is a deliberate
line, not a technical limitation: a platform where one student pays another
to produce a finished deliverable that gets submitted as the poster's own
work is contract cheating / academic fraud, and isn't something this
project is set up to support. The copy in the app (delivery prompt on the
request page) reflects this — please keep it that way if you customize it.

## Setup

```bash
npm install
cp .env.example .env
# edit .env and paste in your Supabase Project URL + anon key
npm run dev
```

## Connecting Supabase

1. Create a free project at https://supabase.com
2. In the SQL Editor, run everything in `writemywords_schema.sql`. This
   creates `profiles`, `requests` (with the open → claimed → delivered →
   approved workflow and a trigger that enforces who can do what), and
   `messages`, all with Row Level Security.
3. Authentication → Providers → Email: keep **Confirm email** ON.
4. Authentication → Settings: consider enabling a CAPTCHA (hCaptcha or
   Turnstile) against bot signups.
5. Settings → API: copy the Project URL and anon public key into `.env`.

## Connecting Razorpay (payments)

Payments are handled by two Supabase Edge Functions in
`supabase/functions/` — **never** by the browser directly, because
creating orders and confirming payment both require your Razorpay secret
key, which must never reach the client.

```bash
# from the Supabase CLI (npm i -g supabase, then supabase login)
supabase link --project-ref <your-project-ref>

supabase secrets set RAZORPAY_KEY_ID=your_key_id
supabase secrets set RAZORPAY_KEY_SECRET=your_key_secret
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key   # Settings → API — keep this one secret

supabase functions deploy create-razorpay-order
supabase functions deploy verify-razorpay-payment
```

Get your Razorpay key id/secret from the Razorpay dashboard (Settings →
API Keys) after creating a free account at https://razorpay.com. Start in
**Test Mode** — Razorpay gives you test card numbers so you can run the
whole flow without moving real money before you go live.

### How the payment flow actually works

1. Student clicks **Approve & Pay** on a delivered request.
2. The app calls `create-razorpay-order`, which checks (server-side) that
   this really is the request's owner, the request is really in
   `delivered` status, and pulls the amount from the database — never
   from anything the browser sends. It creates the Razorpay order and
   returns just the order id.
3. Razorpay's Checkout widget opens in the browser for the student to pay.
4. On success, the app calls `verify-razorpay-payment`, which
   **recomputes the payment signature using your secret key** and only
   then marks the request `approved` and records the payment — using the
   service-role key, which bypasses RLS because this one call is trusted
   server-side logic, not a client request.

This means the client is never the source of truth for "this was paid" —
it's always re-derived from Razorpay's own signed response.

## The workflow, end to end

```
open → claimed → delivered → approved
```

- **open** — posted, visible on `/board` to everyone (no contact info shown)
- **claimed** — a helper picked it up (`Help With This`); locks so nobody
  else can claim the same request
- **delivered** — helper submitted their guidance via the request page
- **approved** — student paid through Razorpay; delivery stays visible to
  both sides

A Postgres trigger (`check_request_transition`, in the SQL file) enforces
who is allowed to move a request between these states, on top of Row Level
Security — so even a bug in the frontend can't let a helper approve their
own delivery, or a random visitor claim a request someone else already
has.

## Project structure

```
src/
  lib/supabaseClient.js   Auth, requests workflow, messages, Razorpay calls
  context/AppContext.jsx  Session/profile, public board, "my" posted+helping requests
  components/             Nav, Footer, RequestCard
  pages/
    Home.jsx              Two options: Post your assignment / I will help
    Login.jsx, Signup.jsx  Real Supabase Auth (email + password)
    PostRequest.jsx        Single-page request form
    Board.jsx              Browse + claim open requests
    RequestDetail.jsx      Messages, delivery, Approve & Pay — the hub
    Dashboard.jsx           What you posted + what you're helping with
supabase/functions/
  create-razorpay-order/    Edge Function — creates the order server-side
  verify-razorpay-payment/  Edge Function — verifies payment, marks approved
public/_headers, vercel.json   Security headers (CSP allows Razorpay + Supabase)
```

## Still worth doing before this handles real students/money

- Enable Razorpay's CAPTCHA-equivalent / Supabase Auth CAPTCHA to cut bot
  signups.
- Add a dispute/refund path — right now there's no way to reverse an
  approved payment from within the app.
- Add push/email notifications for "your request was claimed" / "you have
  a new message" (Supabase's `pg_net` + a Database Webhook is a
  reasonable way to trigger these from the Edge Functions or triggers).
- Get a real security/compliance review before handling actual payments —
  this repo covers application-level access control and a correctly
  server-verified payment flow, not PCI compliance as a whole.
