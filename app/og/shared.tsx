/**
 * Shared chrome for every share preview — doc 04 §5.16.
 *
 * One file so a poll preview and a Space preview cannot drift apart. They are
 * seen side by side in the same WhatsApp thread, and two different-looking cards
 * from the same product is the thing that reads as amateur.
 *
 * **Dark on purpose.** The rest of MaxPoll is a light paper surface, and this is
 * the one place doc 04 permits a gradient. A chat list is a column of white
 * bubbles; a dark card is the only thing in it that stops a thumb.
 *
 * No custom fonts. `next/font` writes its files into the build output, not the
 * repo, so loading Lora here would mean fetching a font over the network on
 * every cold preview render — for a 1200×630 image that is cached for 60s at the
 * edge anyway. System sans, and the weight does the work.
 */
import type { CSSProperties } from "react";

export const OG = { width: 1200, height: 630 };

/** Straight from `:root` in globals.css — the same colours, the same jobs. */
export const C = {
  ink: "#111114",
  gold: "#F5B324",
  teal: "#0B6169",
  heat: "#E8452C",
  paper: "#FAFAF7",
  dim: "rgba(255,255,255,.55)",
  dimmer: "rgba(255,255,255,.16)",
} as const;

export const HEADERS = {
  "Cache-Control": "public, max-age=0",
  "CDN-Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
};

/**
 * Satori has no cascade and no `display: block` default — every element with
 * more than one child needs `display: flex` spelled out. These exist so that is
 * written once rather than forty times.
 */
export const row: CSSProperties = { display: "flex", alignItems: "center" };
export const col: CSSProperties = { display: "flex", flexDirection: "column" };

export const shell: CSSProperties = {
  ...col,
  width: "100%",
  height: "100%",
  justifyContent: "space-between",
  padding: "54px 72px",
  // A single soft teal light source, top-left, over near-black. Reads as depth
  // rather than as a decorative gradient sitting on top of the content.
  backgroundColor: C.ink,
  backgroundImage: `radial-gradient(1100px 620px at 8% -10%, rgba(11,97,105,.55), rgba(17,17,20,0) 62%)`,
  color: "#fff",
  fontFamily: "sans-serif",
};

/** The eyebrow pill — Space name, or the wordmark when a poll has no Space. */
export function Eyebrow({ text, live }: { text: string; live: boolean }) {
  return (
    <div
      style={{
        ...row,
        gap: 12,
        alignSelf: "flex-start",
        border: `1px solid ${C.dimmer}`,
        borderRadius: 999,
        padding: "10px 20px",
        fontSize: 22,
        fontWeight: 700,
        letterSpacing: 2,
        textTransform: "uppercase",
        color: C.dim,
      }}
    >
      {live && (
        <div
          style={{ width: 12, height: 12, borderRadius: 999, backgroundColor: C.heat }}
        />
      )}
      <div style={{ display: "flex" }}>{text}</div>
    </div>
  );
}

/**
 * The hook strip along the bottom. This is the line that decides whether the
 * card gets tapped, so it is set at the same weight as the title rather than as
 * a caption.
 */
export function Hook({ text, accent }: { text: string; accent: string }) {
  return (
    <div style={{ ...row, gap: 20 }}>
      <div style={{ width: 6, height: 46, borderRadius: 99, backgroundColor: accent }} />
      <div style={{ display: "flex", fontSize: 34, fontWeight: 700, color: "#fff" }}>
        {text}
      </div>
    </div>
  );
}

/** Clipped so a long name cannot push the bar and percentage off the card. */
export function clip(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
