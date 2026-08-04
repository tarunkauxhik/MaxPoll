# Payments

**Phase 1 collects money over manual UPI. Razorpay is the later rail** — see §5.

Manual UPI means: the payer sends ₹9 from their own UPI app to a
PhonePe-for-Business VPA, types the 12-digit UTR back into MaxPoll, and an admin
matches it against the merchant app before access unlocks.

Why this first: **zero MDR**, so ₹9 nets ₹9 instead of ₹8.79, and there is no
gateway to integrate, no webhook to secure, and no KYC waiting period between
"idea" and "someone can pay me". The cost is a human in the loop, which is the
correct trade at the volume this launches at. When the queue stops being
viable, §5 switches rails without touching access control.

> **Vercel Hobby forbids commercial use.** Manual UPI is commercial use exactly
> as much as Razorpay was. Production ships anyway — a deliberate, recorded call
> ([DECISIONS](DECISIONS.md) D1). The penalty if enforced is project suspension.

## 1. The switch

One env var, four values, **fails closed**.

```bash
NEXT_PUBLIC_PAYMENTS_MODE=manual_upi
NEXT_PUBLIC_UPI_VPA=maxpoll@ybl          # empty ⇒ forced to coming_soon
NEXT_PUBLIC_UPI_PAYEE_NAME=MaxPoll       # what shows on the payer's UPI screen
ADMIN_USER_IDS=<profile-uuid>            # empty ⇒ nobody reaches /admin
```

| Mode | Behaviour |
|---|---|
| `coming_soon` | Sheet renders identically, CTA opens the coming-soon panel, **no order row created** |
| `manual_upi` | QR + intent link + UTR form + admin queue |
| `razorpay_test` / `razorpay_live` | **Reserved, not implemented.** Currently resolve to `coming_soon` |

Logic lives in [`lib/payments.ts`](../lib/payments.ts), tested by
`lib/payments.test.mts` (`pnpm test`). Three things that must never regress, and
each has a test:

- anything unrecognised → `coming_soon`
- `manual_upi` with no VPA → `coming_soon`, because a payment screen pointing at
  nobody is worse than no payment screen
- an empty `ADMIN_USER_IDS` means **nobody**, never everybody

## 2. Architecture

```
Payer                    MaxPoll                 Their UPI app        Admin
  │                         │                          │                │
  ├─ tap "Unlock ₹9" ──────►│                          │                │
  │                         ├─ insert orders (pending) │                │
  │◄── ref MP7K3QD2, QR ────┤                          │                │
  ├─ scan / tap ───────────────────────────────────────►│                │
  │              (pays ₹9 from their own bank)          │                │
  │◄────────────────── UTR 402318774521 ────────────────┤                │
  ├─ submit UTR ───────────►│                          │                │
  │                         ├─ orders → submitted ─────────────────────►│
  │                         │                          │   matches UTR  │
  │                         │◄──────── verify_order() ─────────────────┤
  │                         ├─ insert entitlements                      │
  │◄── unlocked ────────────┤                                           │
```

**`orders` is the ledger. `entitlements` is the access grant.** They are separate
tables and `verify_order()` is the only bridge. That separation is what lets
Razorpay arrive later writing *only* entitlements, and it is why the RLS policy
protecting voter names never had to change when the rail did.

## 3. What software can and cannot enforce here

Be honest about this, because it drives the whole admin design.

**Enforced in the database, not in app code:**

| Guarantee | Mechanism |
|---|---|
| One UTR unlocks exactly once | `unique (upper(btrim(utr)))` — otherwise one payer forwards the reference to fifty friends |
| One open order per user per thing | `orders_open_uniq`, `nulls not distinct` so the pass isn't exempt |
| Price cannot be client-authored | `amount_paise` is a **generated column** off `kind` |
| A payer cannot approve themselves | Update policy scoped to `status = 'pending'`; `verify_order` execute revoked from `anon` and `authenticated` |
| A payer cannot switch `kind` after paying | **Column-level grants.** RLS chooses rows, not columns — without the grant, a payer flips their own ₹99 order to `poll_unlock` and pays ₹9 |
| Nobody reads anyone else's order | No admin `select` policy exists at all. The panel reads through the secret key, which bypasses RLS |

**Not enforceable — this is the human's job:**

The amount. A UPI intent's `am` is editable in several apps, and a static QR
carries no amount at all. So `orders.amount_paise` is what the payment *should*
have been, and the admin comparing it against the merchant app **is** the amount
check. That is why the queue prints `₹9 expected` beside every UTR: if it isn't
on screen, it doesn't happen.

## 4. The flow

### 4.1 Order

Created server-side on paywall tap. The client sends `kind` and `poll_id` and
nothing else — `ref` is defaulted by the database, `amount_paise` is generated,
`status` isn't in the insert grant.

### 4.2 Pay — `/pay/[ref]`

Server component. 404s if the order isn't yours.

**Mobile** — an intent link built to the NPCI linking spec:

```
upi://pay?pa=<VPA>&pn=MaxPoll&am=9.00&cu=INR&tr=MP7K3QD2&tn=MaxPoll MP7K3QD2
```

`tr` is the spec's transaction-reference field and is where the ref belongs.
`tn` is free text the payer can edit, so it is never read back as
identification. `ref` is short and alphanumeric (`MP` + 6 hex) because a UUID
does not fit `tr`.

**Desktop** — the same string as a QR, rendered **server-side as inline SVG**.
Zero client JS, nothing added to the LCP budget.

**Then the UTR form** — 12 digits, `inputMode="numeric"`. The contact field is
optional and prefilled from the account email; the payer is already signed in
and `user_id` is the real identity, so it exists for "reach me if something's
wrong", not for identification.

### 4.3 States

Instructions, never apologies — house style from [03-ux-flows.md](03-ux-flows.md).

| Status | Screen |
|---|---|
| `pending` | Pay, then enter your UTR. Reference `MP7K3QD2` |
| `submitted` | `Got it — checking your payment. Usually within a few hours.` |
| `verified` | Unlock animation: blur 4.5px → 0, 400ms, count-up |
| `rejected` | The admin note verbatim, plus how to reach a human |

**No email is sent.** There is no mail service and adding one costs money; the
status lives in the app. Add email when someone actually complains about not
knowing.

### 4.4 Admin — `/admin`

Server component, gated by the `ADMIN_USER_IDS` allowlist. **Not a
`profiles.is_admin` column** — a column is a row someone might one day be able
to write; an allowlist is a value only a deploy can change
([DECISIONS](DECISIONS.md) D3).

```
MP7K3QD2   ₹9 expected   UTR 402318774521   @tarun   2h ago   [Verify] [Reject]
```

Verify and Reject are server actions running through the secret key. Verify
calls `verify_order()`, which flips the order and grants the entitlement **in
one transaction** — half of that happening is either someone paying and not
getting in, or getting in with no ledger row. Reject requires a note, because
that note is the only thing the payer gets back.

A non-admin gets **404, not 403** — don't confirm the route exists.

> **Proxy:** `/admin` and `/pay/*` must go *through* the session proxy;
> they need auth cookies. They are **not** exceptions like `/api/poll/*/board`.
> Do not add them to the [DECISIONS](DECISIONS.md) A2 exclusion list — that list
> protects edge-cached routes, and these are neither cached nor cacheable.

### 4.5 The ₹99 tier is a 30-day pass

Not a subscription. Manual UPI has no mandate, so auto-renew is impossible;
re-verifying a UTR by hand every month for every subscriber does not scale past
about ten people. `verify_order()` writes `expires_at = now() + 30 days` against
the existing `sub_monthly` entitlement kind, so the existing RLS policy expires
it correctly with no change ([DECISIONS](DECISIONS.md) D4).

Real recurring billing is a reason to switch to §5, not a reason to fake it here.

## 5. Razorpay — the later rail

**Not built.** Test keys sit unused in `.env.local`; the mode values are
reserved and currently resolve to `coming_soon`.

Switch when the manual queue costs more attention than the revenue justifies —
roughly when verification stops fitting into one sitting a day.

What it needs when that day comes:

1. `POST /api/pay/order` — amount from `PRICES` server-side, **never** from the
   request body
2. `POST /api/pay/verify` — HMAC of `order_id|payment_id` with the key secret
3. `POST /api/pay/webhook` — `runtime = 'nodejs'`, HMAC over the **raw body**
   with the *webhook* secret (a different value from the key secret), return 200
   fast or Razorpay retries and you double-process
4. Both paths write `entitlements` with `source='razorpay'`; the
   `(source, payment_ref)` unique index already makes that idempotent

**No change to RLS, to `entitlements`, or to how names are gated.** That is the
whole point of the ledger/grant split — the schema for this is already applied.

Economics for the decision: Razorpay is 2% + GST, so ₹9 nets ≈ ₹8.79 against
₹9.00 on UPI. You are buying automation, not margin.

## 6. Gating reads — server-side only, unchanged

```sql
create policy votes_read_entitled on votes for select using (
  exists (select 1 from entitlements e
          where e.user_id = auth.uid()
            and (e.poll_id = votes.poll_id or e.kind = 'sub_monthly')
            and (e.expires_at is null or e.expires_at > now()))
);
```

> **Never send names to the client and blur them in CSS.** Anyone can open
> DevTools. The blurred chips contain **fake placeholder strings** until the
> entitlement check passes server-side.

Verified live at Gate 2: with the publishable key, `votes` returns `[]` for a
poll with a real vote in it, while `options` on the same request path returns
its row — so the empty array is RLS working, not a dead key.

## 7. Gate P — the manual pipeline

| # | Test | Expected |
|---|---|---|
| 1 | `coming_soon` → tap ₹9 | Panel shown, **no order row created** |
| 2 | order → pay → UTR → verify | Entitlement written, names unblur |
| 3 | **Reuse a UTR from another order** | Blocked by the unique index, not by app code |
| 4 | Two open orders, same poll, same account | Blocked by `orders_open_uniq` |
| 5 | Unentitled user calls the names API directly | 403 — names never leave the server |
| 6 | Client PATCHes its own order to `verified` | Denied by RLS |
| 7 | Client PATCHes its own order's `kind` or `amount_paise` | Denied by the column grant |
| 8 | Non-admin opens `/admin` | 404 |
| 9 | `verify_order` twice on one order | `NOT_PENDING`, exactly one entitlement |
| 10 | 30-day pass with `expires_at` in the past | Paywall returns |
| 11 | Order while signed out | Blocked — there is no anonymous order path |

**Test 5 is the one people skip and the one that actually matters.**

## 8. Analytics

`paywall_view` · `paywall_intent` · `order_created` · `utr_submitted` ·
`order_verified` · `order_rejected`

The interesting ratio is **`utr_submitted / order_created`** — the share of
people who reach the QR and actually complete a payment they have to type a
reference number for. That number, not `paywall_intent`, is what says whether
the manual pipeline is costing sales and Razorpay is worth it.

## 9. Refunds

Non-refundable, stated before payment. On manual UPI a refund is a UPI transfer
you send by hand; mark the order `rejected` with a note so the ledger matches
reality.
