import { clean } from "@/lib/env";

/**
 * The site's own origin, resolved once.
 *
 * Pinned rather than inferred: the poll page's `og:image` is a relative path, so
 * a wrong guess sends every WhatsApp preview at the wrong host — and the share
 * preview is a growth mechanic, not a detail (04 §5.16). `robots.txt` and
 * `sitemap.xml` need absolute URLs for the same reason.
 *
 * Falls back to the Vercel deployment URL so preview builds still resolve, then
 * to localhost for `pnpm dev`.
 *
 * ⚠️ `process.env.NEXT_PUBLIC_SITE_URL` is spelled out in full on purpose — Next
 * inlines `NEXT_PUBLIC_*` textually at build time and never substitutes a
 * dynamic lookup. See lib/env.ts.
 */
export function siteUrl(): string {
  return (
    clean("NEXT_PUBLIC_SITE_URL", process.env.NEXT_PUBLIC_SITE_URL) ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000")
  );
}
