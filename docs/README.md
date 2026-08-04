# MaxPoll docs

Everything about this project lives here. **Start with [STATE.md](STATE.md)** — it
says where we are and what's next.

## Which file answers which question

| I want to know… | Read |
|---|---|
| Where are we right now? What's blocked? | **[STATE.md](STATE.md)** |
| Why was it built this way? Why does this contradict what I expected? | **[DECISIONS.md](DECISIONS.md)** |
| Has this bitten us before? What are the real free-tier numbers? | **[LEARNINGS.md](LEARNINGS.md)** |
| What is MaxPoll, who's it for, how does it make money? | [01-product.md](01-product.md) |
| What's the stack, the schema, the performance rules? | [02-architecture.md](02-architecture.md) |
| What happens on this screen? What does an empty state say? | [03-ux-flows.md](03-ux-flows.md) |
| What colour, what size, what spacing? | [04-design.md](04-design.md) |
| How does the ₹9 payment work? | [05-payments.md](05-payments.md) |
| What am I building next, and how do I know it's done? | [06-build-plan.md](06-build-plan.md) |
| How do I set up Supabase / Google / Vercel / PhonePe? | [07-setup.md](07-setup.md) |
| How do I run it, test it, deploy it, delete it? | [08-runbook.md](08-runbook.md) |

## How these files work

**CAPS files are living** — they change constantly, and they're the ones to read first
and update last in every session.

**Numbered files are reference** — they change only by decision, and the decision gets
recorded in `DECISIONS.md`.

**`DECISIONS.md` overrides everything.** When a numbered file and a decision conflict,
the decision is current and the numbered file needs fixing.

## Source of truth

| Thing | Truth lives in |
|---|---|
| Visual design | `app/globals.css`, explained by [04-design.md](04-design.md) |
| Database schema | `supabase/migrations/`, explained by [02-architecture.md](02-architecture.md) |
| Everything else | These docs |

Where code and docs disagree, **the code is what ships** — fix the code if it's
wrong, then fix the doc. Never leave them disagreeing.

## Conventions

- Every claim about a provider's free tier carries the date it was verified.
  Providers move these numbers; re-check before launch.
- Exact values (hex, px, ms) are quoted exactly. "About 12px" is not a spec.
- Copy that users see is quoted verbatim so it can be grepped.
