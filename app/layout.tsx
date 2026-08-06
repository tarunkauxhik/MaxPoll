import type { Metadata, Viewport } from "next";
import { Archivo, Space_Grotesk, Space_Mono } from "next/font/google";
import { clean } from "@/lib/env";
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
  // Pinned rather than inferred. Next currently guesses this correctly from the
  // deployment, but the poll page's og:image is a relative path and a wrong guess
  // means WhatsApp previews point at the wrong host — and the share preview is a
  // growth mechanic, not a detail (04 §5.16). Falls back to the Vercel URL so
  // preview deployments still resolve.
  metadataBase: new URL(
    clean("NEXT_PUBLIC_SITE_URL", process.env.NEXT_PUBLIC_SITE_URL) ||
      (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : "http://localhost:3000")
  ),
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
      <body>{children}</body>
    </html>
  );
}
