import type { Metadata, Viewport } from "next";
import { Inter, Lora } from "next/font/google";
import { Analytics } from "@/components/Analytics";
import { siteUrl } from "@/lib/site";
import "./globals.css";

/**
 * Two faces. Inter for the interface, Lora for anything that reads as a
 * headline — docs/DESIGN.md.
 *
 * Both are variable, so one file each covers every weight they may use. Lora
 * *can* reach 700 and must not: the cap of 500 is enforced in
 * scripts/check-contrast.mjs, because a bundler cannot see a CSS weight and a
 * rule nobody can run is a rule that stops being true.
 *
 * Instrument Serif was here and is gone; Lora now carries the display sizes it
 * held. Space Mono is gone too — `.num` uses Inter's tabular figures.
 */
const inter = Inter({
  variable: "--font-ui",
  subsets: ["latin"],
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
  /**
   * app/favicon.ico is generated, not drawn by hand — six real sizes (16 → 256)
   * from the same geometry as public/icon.svg. Next picks it up by convention;
   * this adds the SVG so anything modern gets the vector and only falls back to
   * the raster when it has to. `apple-touch-icon` has no SVG support at all,
   * which is why the 180px PNG points at the ICO's own large frame.
   */
  icons: {
    // `app/favicon.ico` emits its own <link> by file convention, so listing it
    // here too would ship two tags pointing at two URLs for one file. Only the
    // things convention does NOT cover go here.
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Matches the top bar, which is what the Android status bar sits against.
  // The bar went light in D15's revision, so this did too — a navy status bar
  // above a white app bar is a seam, not a design. app/manifest.ts must carry
  // the same value; its `background_color` is the page behind a cold start.
  themeColor: "#FFFFFF",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${lora.variable}`}
    >
      <body>
        {children}
        {/**
         * Pageviews only, with `/u/*` and `/pay/*` redacted — see the component.
         *
         * ⚠️ It injects routes under `/_vercel/insights/*`, which is why the
         * `proxy.ts` matcher now excludes `_vercel`. Without that exclusion every
         * pageview beacon would run the proxy — an `auth.getUser()` round trip to
         * Supabase per view. Same failure shape as RULES.md, caching: nothing errors,
         * the bill just scales with traffic.
         *
         * Does nothing until Web Analytics is enabled in the Vercel dashboard.
         */}
        <Analytics />
      </body>
    </html>
  );
}
