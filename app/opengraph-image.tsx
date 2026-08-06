import { ImageResponse } from "next/og";
import { C, OG, shell, row, col } from "./og/shared";

/**
 * The preview for **maxpoll's own link**, and the fallback for every route that
 * does not build its own (Spaces list, profiles, /privacy, /terms).
 *
 * There was none. Pasting `viratkohli.tech` into a group produced a bare blue
 * link with no image, which for a product whose entire growth model is a link
 * travelling between WhatsApp groups is the cheapest thing on the list to fix.
 *
 * **Static, and deliberately so.** Next renders this at build time as long as it
 * touches no request data. Reading live stats would make it dynamic, cost a
 * database round trip per unfurl, and publish a number that goes stale between
 * deploys anyway — 01-product is explicit that a number on this surface has to
 * be real or absent. The demo board is unmistakably a sample, exactly as it is
 * on the landing page it mirrors.
 */
export const size = OG;
export const contentType = "image/png";
export const alt = "MaxPoll — everyone has an opinion, now there's a scoreboard";

const DEMO = [
  { rank: 1, name: "Rajma Sir", pct: 34, w: 100 },
  { rank: 2, name: "Verma Ma'am", pct: 24, w: 70 },
  { rank: 3, name: "Anand Sir", pct: 19, w: 56 },
];

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ ...shell, justifyContent: "center", gap: 52 }}>
        <div style={{ ...col, gap: 22 }}>
          <div
            style={{
              ...row,
              gap: 12,
              alignSelf: "flex-start",
              fontSize: 24,
              fontWeight: 800,
              letterSpacing: 3,
              textTransform: "uppercase",
              color: C.dim,
            }}
          >
            <div
              style={{ width: 12, height: 12, borderRadius: 99, backgroundColor: C.heat }}
            />
            <div style={{ display: "flex" }}>Live leaderboards</div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 76,
              fontWeight: 800,
              lineHeight: 1.02,
              letterSpacing: -3,
            }}
          >
            <div style={{ display: "flex" }}>Everyone has an opinion.</div>
            <div style={{ display: "flex", gap: 20 }}>
              <div style={{ display: "flex" }}>Now there&apos;s a</div>
              <div style={{ display: "flex", color: C.gold }}>scoreboard.</div>
            </div>
          </div>
        </div>

        <div style={{ ...col, gap: 16 }}>
          {DEMO.map((d) => (
            <div key={d.rank} style={{ ...row, alignItems: "flex-start", gap: 22 }}>
              <div
                style={{
                  display: "flex",
                  width: 44,
                  paddingTop: 4,
                  fontSize: 28,
                  fontWeight: 700,
                  color: d.rank === 1 ? C.gold : C.dim,
                }}
              >
                {String(d.rank).padStart(2, "0")}
              </div>
              <div style={{ ...col, flex: 1, gap: 8 }}>
                <div style={{ ...row, justifyContent: "space-between" }}>
                  <div
                    style={{
                      display: "flex",
                      fontSize: 32,
                      fontWeight: d.rank === 1 ? 700 : 500,
                      color: d.rank === 1 ? "#fff" : "rgba(255,255,255,.82)",
                    }}
                  >
                    {d.name}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      fontSize: 28,
                      fontWeight: 700,
                      color: d.rank === 1 ? C.gold : C.dim,
                    }}
                  >
                    {d.pct}%
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    height: 10,
                    borderRadius: 99,
                    backgroundColor: "rgba(255,255,255,.10)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      width: `${d.w}%`,
                      borderRadius: 99,
                      backgroundColor: d.rank === 1 ? C.gold : "rgba(255,255,255,.42)",
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ ...row, gap: 18, fontSize: 30, color: C.dim }}>
          <div style={{ display: "flex", fontWeight: 800, color: "#fff" }}>MaxPoll</div>
          <div style={{ display: "flex", color: C.dimmer }}>·</div>
          <div style={{ display: "flex" }}>Make a poll. Watch names climb.</div>
        </div>
      </div>
    ),
    size
  );
}
