"use client";

import { Analytics as Vercel } from "@vercel/analytics/next";

/**
 * Vercel Web Analytics, with two paths redacted before they leave the browser.
 *
 * Vercel stores the **URL of every pageview**, and their own docs name this
 * exact shape as the thing to watch for: `acme.com/[name of individual]/…`.
 * MaxPoll has two of them.
 *
 *   /u/tarunkauxhik  → a real person's handle
 *   /pay/ord_abc123  → an order reference, which is a payment identifier
 *
 * Neither tells us anything a template could not: "how much profile traffic is
 * there" and "how many people reach the pay screen" are the only questions, and
 * the collapsed form answers both. Everything else — `/p/<slug>`, `/s/<slug>` —
 * is public content whose per-poll traffic is the entire reason for adding
 * analytics at all, so it is left alone.
 *
 * A client component because `beforeSend` is a function, and a Server Component
 * cannot pass one across the boundary.
 *
 * **Hobby is pageviews only.** `track()` is a Pro feature and does nothing here.
 */
export function Analytics() {
  return (
    <Vercel
      beforeSend={(event) => ({
        ...event,
        url: event.url
          .replace(/\/u\/[^/?#]+/, "/u/[handle]")
          .replace(/\/pay\/[^/?#]+/, "/pay/[ref]"),
      })}
    />
  );
}
