import { EMOJI_MAP } from "@/lib/emoji";

/**
 * Renders a bundled Apple-style glyph instead of the system emoji font, so
 * the same character looks the same on Android and iOS — DECISIONS D13.
 *
 * `label` is the accessible name when the emoji carries meaning on its own
 * (a status icon with no adjacent text); omit it when the surrounding text
 * already says the same thing, which is the common case here.
 */
export function Emoji({ char, label }: { char: string; label?: string }) {
  // Source literals inconsistently include the U+FE0F variation selector
  // (copy-paste dependent, invisible either way) — EMOJI_MAP keys are the
  // bare codepoint, so strip it before lookup rather than require every
  // call site to match exactly.
  const file = EMOJI_MAP[char.replace(/️/g, "")];
  // Falls back to the system glyph rather than rendering nothing — a
  // forgotten lib/emoji.ts entry should degrade, not disappear.
  if (!file) {
    return (
      <span aria-hidden={label ? undefined : "true"} aria-label={label}>
        {char}
      </span>
    );
  }
  return (
    <img
      className="emoji"
      src={`/emoji/${file}.png`}
      alt={label ?? ""}
      aria-hidden={label ? undefined : "true"}
      width={20}
      height={20}
    />
  );
}
