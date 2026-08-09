/**
 * The three brand marks a profile can link out to.
 *
 * Monochrome and `currentColor`, not the platforms' brand colours: three
 * saturated logos on one row would be the only place on the site where colour
 * is decorating rather than doing its one job (CLAUDE.md), and pink/black/yellow
 * next to a gold badge chip is exactly the thing that reads as clip art.
 *
 * Filled glyphs rather than the nav's 1.75-stroke outlines. A brand mark is
 * recognised by its silhouette — an outlined Snapchat ghost at 15px is a blob —
 * and these are the only filled icons in the product for that reason.
 *
 * `aria-hidden` on all three: the chip that wraps them carries the accessible
 * name, because "Instagram" as icon-alt plus "@handle" as text reads as two
 * separate things to a screen reader.
 */

const BOX = {
  width: 15,
  height: 15,
  viewBox: "0 0 24 24",
  fill: "currentColor",
  "aria-hidden": true,
} as const;

export type SocialKey = "Instagram" | "X" | "Snapchat";

/**
 * Rounded square, lens, flash — the mark as Instagram itself draws it, at a
 * stroke weight that survives 15px. Built from primitives rather than carried as
 * one long path so it can be read and adjusted.
 */
function Instagram() {
  return (
    <svg {...BOX} fill="none" stroke="currentColor" strokeWidth={2.1}>
      <rect x="2.6" y="2.6" width="18.8" height="18.8" rx="5.4" />
      <circle cx="12" cy="12" r="4.6" />
      <circle cx="17.6" cy="6.4" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** The post-2023 mark. Two crossing strokes, mitred — not a letter X set in a
 *  font, which is what it looks like if you draw it with round caps. */
function X() {
  return (
    <svg {...BOX}>
      <path d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.41l-5.8-7.58-6.64 7.58H.47l8.6-9.83L0 1.15h7.59l5.25 6.93zM17.61 20.64h2.04L6.49 3.24H4.3z" />
    </svg>
  );
}

/**
 * The ghost, redrawn as a silhouette: bell-shaped head, the two ear lobes at the
 * temples, scalloped hem. Not the official path — that one is ~1.4kB of curve
 * data tuned for 512px and it silts up below about 24px.
 */
function Snapchat() {
  return (
    <svg {...BOX}>
      <path d="M12 2.2c2.72 0 4.62 1.86 4.72 4.55.03.72 0 1.45-.04 2.06.32.14.72.1 1.2-.11.5-.23 1.06.03 1.2.5.13.45-.13.9-.66 1.12-.28.12-.62.22-.9.33-.4.16-.6.34-.55.6.02.1.06.2.11.32.5 1.1 1.5 2.6 3.19 3.02.42.1.66.44.6.82-.06.4-.4.62-.85.73-.5.12-1.06.2-1.44.26-.1.02-.16.06-.2.14-.06.15-.1.4-.17.66-.1.36-.32.55-.7.52-.3-.02-.72-.12-1.2-.12-.44 0-.83.05-1.2.2-.4.16-.79.45-1.24.75-.6.4-1.28.75-2.07.75s-1.47-.35-2.07-.75c-.45-.3-.84-.59-1.24-.75-.37-.15-.76-.2-1.2-.2-.48 0-.9.1-1.2.12-.38.03-.6-.16-.7-.52-.07-.26-.11-.5-.17-.66a.26.26 0 0 0-.2-.14c-.38-.06-.94-.14-1.44-.26-.45-.11-.79-.34-.85-.73-.06-.38.18-.72.6-.82 1.69-.42 2.69-1.92 3.19-3.02.05-.12.09-.22.11-.32.05-.26-.15-.44-.55-.6-.28-.11-.62-.21-.9-.33-.53-.22-.79-.67-.66-1.12.14-.47.7-.73 1.2-.5.48.21.88.25 1.2.11-.04-.61-.07-1.34-.04-2.06C7.38 4.06 9.28 2.2 12 2.2z" />
    </svg>
  );
}

const ICONS: Record<SocialKey, () => React.ReactElement> = {
  Instagram,
  X,
  Snapchat,
};

export function SocialIcon({ platform }: { platform: SocialKey }) {
  const Glyph = ICONS[platform];
  return <Glyph />;
}
