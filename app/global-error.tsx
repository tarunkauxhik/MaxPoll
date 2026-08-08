"use client";

/**
 * The root layout itself failing — a font load, `metadataBase`, a bad env var.
 *
 * This replaces `<html>` and `<body>` entirely, so it cannot use AppShell, the
 * design tokens, or anything from globals.css: none of it has loaded. Hence the
 * inline styles, which is the one place in this codebase they are correct — and
 * hence the hardcoded hex, which has to be updated by hand when the palette
 * moves. It mirrors `:root` as of DECISIONS D15: page, ink, body, brand, muted.
 *
 * It should essentially never render. If it does, the deploy is broken, not the
 * page — so the copy says so rather than offering a retry that will fail again.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          background: "#F4F6FA",
          color: "#101828",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 360 }}>
          <p style={{ fontSize: 40, margin: 0 }}>🛠️</p>
          <h1 style={{ fontSize: 22, margin: "12px 0 8px" }}>MaxPoll is down</h1>
          <p style={{ color: "#3D485C", lineHeight: 1.5, margin: "0 0 20px" }}>
            Not your connection — ours. Try again in a minute.
          </p>
          {/* A plain <a>, deliberately. <Link> is a client-side navigation, and
              the thing that just failed is the root layout the client router
              lives in — soft-navigating would re-render the same broken tree.
              A full document load is the only thing that can recover. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            style={{
              display: "inline-block",
              minHeight: 48,
              lineHeight: "48px",
              padding: "0 24px",
              borderRadius: 16,
              background: "#3B4FD8",
              color: "#fff",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Reload
          </a>
          {error.digest && (
            <p style={{ color: "#59637A", fontSize: 12, marginTop: 20 }}>
              Reference {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
