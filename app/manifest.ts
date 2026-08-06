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
    // Matches the `themeColor` in the root viewport export. If one changes, both
    // must: Android tints the status bar from this, the browser from that.
    background_color: "#FAFAF7",
    theme_color: "#FAFAF7",
    lang: "en-IN",
    categories: ["social", "entertainment"],
    icons: [
      { src: "/favicon.ico", sizes: "any", type: "image/x-icon" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
