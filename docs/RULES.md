# Rules

The things that cost real money, leak real data, or break silently. Everything
else is a judgement call — make it and move on.

This file replaced `DECISIONS.md`, `LEARNINGS.md` and five spec documents in
August 2026. They are in git history if a decision ever needs archaeology; the
process ceremony around them is not coming back.

---

## Security — the database is the guard

A Server Action is a public HTTP endpoint. The publishable key ships to every
browser. So a check in TypeScript is an error message, never a control.

- **Writes go through RPCs.** `INSERT` is revoked on `votes`, `messages` and
  `options`. Same for `polls` and `spaces` updates — `update_poll()`,
  `create_space()` and friends are the only paths.
- **Never pass identity into a `security definer` function.** It runs past RLS,
  so every argument is attacker-controlled. Use `auth.uid()`. `cast_vote` once
  took a `p_user` and let anyone vote as anyone.
- **RLS picks rows, not columns.** Any client-writable table with a status or
  price column also needs `revoke`/`grant` at column level.
- **Voter names are gated server-side by entitlement.** Never sent to the client
  and blurred in CSS — anyone can open DevTools.
- **Admin is an env allowlist** (`ADMIN_USER_IDS`), not a column. Admin routes
  404 rather than 403, so probing does not confirm they exist. `/admin` uses the
  service role, which bypasses RLS entirely — that is the only unbounded path in
  the product and every action in `app/admin/actions.ts` re-checks admin itself.
- **No password flows.** Google OAuth only. No forgot/reset.

## Money

- **`orders` is the ledger; `entitlements` is the grant.** Never merged. Access
  is granted *only* through `verify_order()`, and a UTR unlocks exactly once —
  the unique index enforces it, not app code.
- **Payments read `NEXT_PUBLIC_PAYMENTS_MODE` and fail closed to
  `coming_soon`.** Four values: `coming_soon` · `manual_upi` · `razorpay_test` ·
  `razorpay_live`. All logic in `lib/payments.ts`. Razorpay is reserved and
  unbuilt.
- `orders.amount_paise` is a generated column — an insert must omit it. The
  admin queue filters `status='submitted'`, not `'pending'`.

## Cost and caching — the free tier is the architecture

- **A `Set-Cookie` on a cached response silently disables edge caching**, with
  no error anywhere. The `proxy.ts` matcher must exclude every cached route and
  `_vercel` (analytics beacons would otherwise run an `auth.getUser()` per
  pageview). This is the single most expensive mistake available.
- **Never `count(*)` for vote counts.** Denormalised counters, incremented in the
  same transaction as the insert.
- **Ranks are computed live inside the cached board route.** No cron for this,
  ever. One cron in `vercel.json` at most, once daily — any sub-daily schedule
  fails the deploy on Hobby.
- The board route is cached at `s-maxage=4`. Cache-bust it once per *mutation*,
  never on the polling path — a unique query string is a new cache key.

## Product invariants

- One vote per person per poll (`votes_poll_user_uniq`). Changing a vote is an
  UPDATE plus −1/+1 on two option counters; `polls.vote_count` does not move.
- A creator can delete their own poll at any time. A creator can delete their own
  Space only while it holds no poll somebody else made — `polls.space_id` is
  `on delete cascade`, so the blast radius is bounded rather than warned about.
- The Space results gate hides *numbers*, never the ballot. Gating the vote
  deadlocks it: member_count can never grow because nobody can vote.
- Deleting cascades. Options, votes, messages, entitlements and activity all
  hang off the poll.

## Gotchas that cost a day each

- **No `loading.tsx` on `/p/[slug]`.** It wraps the segment in Suspense, the
  `200` goes on the wire before `notFound()` can run, and every mangled poll link
  answers 200. Moving `notFound()` earlier does not rescue it.
- **`now()` is the transaction clock**, identical for every row inserted in one
  transaction — it silently killed a `created_at` tiebreak.
- **Two rules with the same specificity are decided by source order.** A
  duplicated class name applies the *later* component's declarations to the
  earlier one. `.soon` meant two things and repainted every urgent poll card.
- **A margin on a component stacks on top of its container's `gap`**, it does not
  replace it. See [DESIGN.md](DESIGN.md) — this was the largest source of uneven
  spacing in the product.
- **Never run a bare `chrome.exe <flag>` on Windows** to check the binary. Every
  invocation is a launch attempt and it attaches to the user's real browser.
- Git Bash mangles `/`-prefixed arguments — `MSYS_NO_PATHCONV=1`.
- PowerShell here-strings do not work in the Bash tool. Use a heredoc.

---

## Working rules

Deliberately short. The old version had a phase gate, a mandatory status-file
update and a full build before every commit, which made a one-line fix cost the
same as a feature.

- **`pnpm verify`** (typecheck + tests, ~5s) while working.
- **`pnpm check`** (full build + lint + contrast + tests) before pushing, not
  before every commit.
- **`pnpm gates`** (live database probes) only when you touched SQL, RLS, an RPC
  or payments.
- Commit when a thing works. Push when it is worth deploying — every push builds.
- pnpm, not npm. No global installs.
- Skip → reuse → stdlib → platform → existing dep → one line → minimum. No
  dependency added before the thing that needs it.
