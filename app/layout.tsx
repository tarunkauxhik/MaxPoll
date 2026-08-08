import type { Metadata, Viewport } from "next";
import { Inter, Instrument_Serif, Lora } from "next/font/google";
import { Analytics } from "@/components/Analytics";
import { siteUrl } from "@/lib/site";
import "./globals.css";

/**
 * Three faces, and no fourth — DECISIONS D15.
 *
 * Inter and Lora are variable, so one file each covers every weight they're
 * allowed to use. Instrument Serif is not variable and ships `400` only, which
 * is exactly why it takes the largest type: it *cannot* render faux-bold, and
 * the hero is where that would show most.
 *
 * Lora can go to 700 and must not. That cap is enforced in
 * scripts/check-contrast.mjs, not here — a bundler can't see a CSS weight.
 *
 * Space Mono is gone; `.num` uses Inter's tabular figures instead.
 */
const inter = Inter({
  variable: "--font-ui",
  subsets: ["latin"],
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const lora = Lora({
  variable: "--font-serif",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  // Pinned, not inferred — see lib/site.ts. Shared with robots.ts and
  // sitemap.ts, which need the same absolute origin.
  metadataBase: new URL(siteUrl()),
  title: "MaxPoll",
  description:
    "Make a poll about anything. Watch names climb a live leaderboard. Every vote is on the record.",
  // The image itself comes from app/opengraph-image.tsx — Next wires it in and
  // every nested route inherits it unless it builds its own. Without these two
  // blocks the site's own link unfurled as a bare URL, which for a product that
  // spreads by being pasted into group chats was the largest hole in the funnel.
  openGraph: {
    type: "website",
    siteName: "MaxPoll",
    title: "MaxPoll — everyone has an opinion, now there's a scoreboard",
    description:
      "Make a poll about anything. Watch names climb a live leaderboard. Every vote is on the record.",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // The chrome, not the page — this is what tints the browser and Android status
  // bar, and the bar it sits against is `--dark`. app/manifest.ts carries the
  // same value for the same reason; its `background_color` is the page.
  themeColor: "#121A2E",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${instrumentSerif.variable} ${lora.variable}`}
    >
      <body>
        {children}
        {/**
         * Pageviews only, with `/u/*` and `/pay/*` redacted — see the component.
         *
         * ⚠️ It injects routes under `/_vercel/insights/*`, which is why the
         * `proxy.ts` matcher now excludes `_vercel`. Without that exclusion every
         * pageview beacon would run the proxy — an `auth.getUser()` round trip to
         * Supabase per view. Same failure shape as DECISIONS A2: nothing errors,
         * the bill just scales with traffic.
         *
         * Does nothing until Web Analytics is enabled in the Vercel dashboard.
         */}
        <Analytics />
      </body>
    </html>
  );
}
