# 06 — Payment Pipeline (Razorpay)

> **Design goal:** fully working in test mode, hard-disabled in production behind one flag. Flip one env var to go live later. No code changes required to switch.

---

## 1. The switch

```bash
# .env.local  (development / preview)
NEXT_PUBLIC_PAYMENTS_MODE=test
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=xxxxxxxxxxxx

# Vercel production env
NEXT_PUBLIC_PAYMENTS_MODE=coming_soon
```

Three possible values. **Only one line changes when you go commercial.**

| Mode | Behaviour |
|---|---|
| `test` | Full Razorpay test checkout, real webhook, real entitlement written |
| `coming_soon` | Sheet renders identically, CTA opens a "Coming soon" panel, **no order created, no Razorpay script loaded** |
| `live` | Production keys, real money (flip to this on Vercel Pro) |

```ts
// lib/payments.ts
export const PAYMENTS_MODE = process.env.NEXT_PUBLIC_PAYMENTS_MODE ?? 'coming_soon';
export const paymentsEnabled = () => PAYMENTS_MODE === 'test' || PAYMENTS_MODE === 'live';
```

**Fail closed:** if the env var is missing, it's `coming_soon`. Never default to a state that could charge someone.

### The coming-soon panel
Keep the ₹9 sheet exactly as designed — same copy, same perks list, same price. Only the CTA changes:
```
[ Unlocking soon 🔒 ]
We're finishing payments. Drop your email and
we'll unlock this poll for you free when it's live.
[ email field ] [ Notify me ]
```
This is better than hiding the paywall: you measure real intent (how many people tap ₹9) while collecting emails, which is exactly the demand signal you need before paying for Vercel Pro.

Log every tap as `paywall_intent` with `poll_id` and `user_id`. **That number decides whether payments are worth turning on at all.**

---

## 2. Architecture

```
Client                    Next.js API              Razorpay          Supabase
  │                            │                       │                 │
  ├─ tap "Pay ₹9" ────────────►│                       │                 │
  │                            ├─ create order ───────►│                 │
  │                            │◄── order_id ──────────┤                 │
  │◄─── order_id, key_id ──────┤                       │                 │
  ├─ open Razorpay Checkout ──────────────────────────►│                 │
  │           (user pays via UPI)                      │                 │
  │◄─── handler(payment_id, signature) ────────────────┤                 │
  ├─ POST /api/pay/verify ────►│                       │                 │
  │                            ├─ verify HMAC          │                 │
  │                            ├─ write entitlement ──────────────────► │
  │◄─── unlocked ──────────────┤                       │                 │
  │                            │                       │                 │
  │        Razorpay webhook ──►│ /api/pay/webhook      │                 │
  │                            ├─ verify signature     │                 │
  │                            ├─ upsert entitlement ─────────────────► │
```

**Two paths write the entitlement — client verify AND webhook.** The client path unlocks instantly (good UX). The webhook is the source of truth (survives the user closing the tab mid-payment). Make the write **idempotent** on `razorpay_payment_id` so both paths landing is harmless.

This redundancy is the single most important reliability decision in the payment flow. Never rely on the client alone.

---

## 3. Implementation

### 3.1 Create order
```ts
// app/api/pay/order/route.ts
import Razorpay from 'razorpay';
import { paymentsEnabled } from '@/lib/payments';

const PRICES = { poll_unlock: 900, sub_monthly: 9900 } as const; // paise

export async function POST(req: Request) {
  if (!paymentsEnabled()) return Response.json({ error: 'COMING_SOON' }, { status: 503 });

  const user = await requireUser(req);                 // 401 if not signed in
  const { kind, pollId } = await req.json();
  if (!(kind in PRICES)) return Response.json({ error: 'BAD_KIND' }, { status: 400 });

  // already owns it? don't charge twice
  if (await hasEntitlement(user.id, pollId, kind))
    return Response.json({ error: 'ALREADY_OWNED' }, { status: 409 });

  const rzp = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  });

  const order = await rzp.orders.create({
    amount: PRICES[kind],                              // NEVER take amount from client
    currency: 'INR',
    receipt: `${kind}_${pollId ?? 'sub'}_${user.id}`.slice(0, 40),
    notes: { user_id: user.id, poll_id: pollId ?? '', kind },
  });

  return Response.json({ orderId: order.id, amount: order.amount, keyId: process.env.RAZORPAY_KEY_ID });
}
```

> **Security rule:** the amount is decided server-side from a constant map. If the client can send an amount, someone will pay ₹1 for a ₹99 subscription.

### 3.2 Checkout (client)
```ts
async function payForPoll(pollId: string) {
  const r = await fetch('/api/pay/order', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ kind: 'poll_unlock', pollId }),
  });
  if (r.status === 503) return showComingSoon();
  const { orderId, amount, keyId } = await r.json();

  new (window as any).Razorpay({
    key: keyId, amount, currency: 'INR', order_id: orderId,
    name: 'MaxPoll', description: 'See the exact names of voters',
    theme: { color: '#6B4EFF' },
    handler: async (res: any) => {
      await fetch('/api/pay/verify', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ ...res, pollId }),
      });
      unlockWithAnimation();                 // blur 4.5px → 0, 400ms + count-up
    },
    modal: { ondismiss: () => track('payment_abandoned', { pollId }) },
  }).open();
}
```
Load `https://checkout.razorpay.com/v1/checkout.js` **lazily on first paywall view** — not in the root layout. In `coming_soon` mode it never loads at all.

### 3.3 Verify (client callback)
```ts
// app/api/pay/verify/route.ts
import crypto from 'crypto';

const expected = crypto
  .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
  .update(`${razorpay_order_id}|${razorpay_payment_id}`)
  .digest('hex');

if (expected !== razorpay_signature) return Response.json({ error:'BAD_SIG' }, { status:400 });
await grantEntitlement({ userId, pollId, kind, paymentId: razorpay_payment_id });
```

### 3.4 Webhook (source of truth)
```ts
// app/api/pay/webhook/route.ts  — export const runtime = 'nodejs'
const raw = await req.text();                          // RAW body, before any parsing
const sig = req.headers.get('x-razorpay-signature')!;
const expected = crypto
  .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)   // webhook secret ≠ key secret
  .update(raw).digest('hex');
if (expected !== sig) return new Response('bad signature', { status: 400 });

const evt = JSON.parse(raw);
if (evt.event === 'payment.captured') {
  const p = evt.payload.payment.entity;
  await grantEntitlement({
    userId: p.notes.user_id, pollId: p.notes.poll_id || null,
    kind: p.notes.kind, paymentId: p.id,
  });
}
return new Response('ok');
```

**Three things that break webhooks and are easy to miss:**
1. Signature must be computed on the **raw body string**. Any middleware that parses JSON first breaks it.
2. The **webhook secret is a different value** from your key secret. Set it in the Razorpay dashboard.
3. Always return **200 quickly**. Do slow work after responding, or Razorpay retries and you double-process.

### 3.5 Idempotent grant
```sql
create unique index if not exists entitlements_payment_uniq
  on entitlements(razorpay_payment_id) where razorpay_payment_id is not null;
```
```ts
await supabaseAdmin.from('entitlements')
  .upsert({ user_id, poll_id, kind, razorpay_payment_id: paymentId,
            expires_at: kind === 'sub_monthly' ? addMonths(new Date(),1) : null },
          { onConflict: 'razorpay_payment_id' });
```

### 3.6 Gating reads — server-side only
```sql
create policy "names visible only to entitled users" on votes for select using (
  exists (select 1 from entitlements e
          where e.user_id = auth.uid()
            and (e.poll_id = votes.poll_id or e.kind = 'sub_monthly')
            and (e.expires_at is null or e.expires_at > now()))
);
```
> **Never send names to the client and blur them in CSS.** Anyone can open DevTools. The blurred chips in the UI must contain fake placeholder strings until the entitlement check passes server-side.

---

## 4. Manual setup (do these yourself)

1. Sign up at `razorpay.com` → **Test Mode** toggle (top right)
2. Settings → API Keys → Generate Test Key → save `rzp_test_...` + secret
3. Settings → Webhooks → Add:
   - URL: `https://<your-vercel-preview>.vercel.app/api/pay/webhook`
   - Events: `payment.captured`, `payment.failed`, `subscription.charged`, `subscription.cancelled`
   - Copy the **webhook secret** into `RAZORPAY_WEBHOOK_SECRET`
4. For local testing: `npx localtunnel --port 3000` and point the webhook at that URL
5. Live keys require KYC (PAN, bank account, business proof) — **do this later**, not now

**Test cards / UPI (test mode only):** success UPI `success@razorpay` · failure UPI `failure@razorpay` · card `4111 1111 1111 1111`, any future expiry, any CVV.

---

## 5. Test checklist

| # | Test | Expected |
|---|---|---|
| 1 | `PAYMENTS_MODE=coming_soon` → tap ₹9 | Coming-soon panel, **no network call to Razorpay**, `paywall_intent` logged |
| 2 | Test mode, `success@razorpay` | Entitlement written, content unblurs with animation |
| 3 | Test mode, `failure@razorpay` | `Payment didn't go through. You weren't charged.` + retry |
| 4 | Close Razorpay modal mid-payment | `payment_abandoned` tracked, no entitlement |
| 5 | Pay, then close tab before verify returns | Webhook still writes entitlement |
| 6 | Replay the same webhook twice | **Exactly one** entitlement row |
| 7 | Tamper the amount in the client request | Server ignores it, charges ₹9 |
| 8 | Forge a signature | 400, no entitlement |
| 9 | Buy the same poll twice | 409 `ALREADY_OWNED`, no second charge |
| 10 | Unpaid user calls the names API directly | 403 — names never leave the server |
| 11 | Subscription expires | Entitlement stops granting, paywall returns |
| 12 | Pay while signed out | 401 |

Test 10 is the one people skip and the one that actually matters.

---

## 6. Analytics to wire from day one
`paywall_view` · `paywall_intent` (the number that decides everything) · `payment_started` · `payment_success` · `payment_failed` · `payment_abandoned`

Funnel: voters → paywall views → intent taps → payments. In `coming_soon` mode you still get the first three, which is exactly the demand data you need before spending money on Vercel Pro.
