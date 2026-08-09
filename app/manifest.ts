import type { MetadataRoute } from "next";

/**
 * Add-to-homescreen. Free reach for a product that spreads by link: someone who
 * has voted three times this week should not have to find the WhatsApp message
 * again to come back.
 *
 * `display: standalone` drops the browser chrome, which on a 480px column is
 * the difference between a website and an app. `start_url: /` lands on the feed
 * for a signed-in user and the landing for everyone else — the same routing the
 * root already does, so there is no second entry point to keep in sync.
 *
 * No screenshots and no maskable icon yet: both need real assets, and shipping
 * a manifest that references files which 404 is worse than a smaller one.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MaxPoll — live leaderboards",
    short_name: "MaxPoll",
    description:
      "Make a poll about anything. Watch names climb a live leaderboard. Every vote is on the record.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    // Two different surfaces, deliberately — RULES.md. `background_color` is
    // the splash behind a cold start, so it's the page (`--paper`).
    // `theme_color` tints the Android status bar, which sits against the top
    // bar, so it's the top bar's colour and must match `themeColor` in the root
    // viewport export.
    //
    // These were both `#FAFAF7` against a viewport of `#0A0E1C` for two phases,
    // under a comment insisting they matched. Nothing warns about it; the splash
    // just flashes the wrong colour. Check both when either moves.
    background_color: "#F4F6FA",
    theme_color: "#FFFFFF",
    lang: "en-IN",
    categories: ["social", "entertainment"],
    // `apple-icon.png` is a full square on purpose — iOS applies its own corner
    // mask, so a pre-rounded icon shows the wallpaper through its corners.
    // `maskable` gets the same square for the same reason on Android.
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/favicon.ico", sizes: "16x16 32x32 48x48 64x64 128x128 256x256", type: "image/x-icon" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png", purpose: "maskable" },
    ],
  };
}
