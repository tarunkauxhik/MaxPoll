import type { Metadata, Viewport } from "next";
import { Archivo, Space_Grotesk, Space_Mono } from "next/font/google";
import { Analytics } from "@/components/Analytics";
import { siteUrl } from "@/lib/site";
import "./globals.css";

// Archivo and Space Grotesk are variable fonts — one file each covers every
// weight. Space Mono is static-only, so 400/700 ship as two files.
const archivo = Archivo({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-ui",
  subsets: ["latin"],
  display: "swap",
});

const spaceMono = Space_Mono({
  variable: "--font-num",
  subsets: ["latin"],
  weight: ["400", "700"],
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
  themeColor: "#FAFAF7",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${spaceGrotesk.variable} ${spaceMono.variable}`}
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
