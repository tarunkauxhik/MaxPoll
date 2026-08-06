/**
 * Character → bundled Apple-style PNG filename (public/emoji/<name>.png).
 *
 * Only the ~28 emoji actually used in the app — not the full emoji-datasource
 * package (102MB unpacked). Extracted once from `emoji-datasource-apple`
 * (MIT-licensed data/glue code; the artwork itself is Apple's — see
 * docs/DECISIONS.md D13) and committed as static files, so the package itself
 * is never a project dependency. Re-derive this list with a fresh grep for
 * `\p{Extended_Pictographic}` across app/ and components/ before trusting it —
 * a new emoji added to the UI needs its PNG added here too.
 */
export const EMOJI_MAP: Record<string, string> = {
  "⚠": "26a0-fe0f",
  "🗳": "1f5f3-fe0f",
  "🔓": "1f513",
  "⏳": "23f3",
  "🔒": "1f512",
  "👥": "1f465",
  "📈": "1f4c8",
  "🏆": "1f3c6",
  "👤": "1f464",
  "🏫": "1f3eb",
  "🔥": "1f525",
  "⚙": "2699-fe0f",
  "🔔": "1f514",
  "🏁": "1f3c1",
  "💬": "1f4ac",
  "✨": "2728",
  "🎬": "1f3ac",
  "✍": "270d-fe0f",
  "🛠": "1f6e0-fe0f",
  "🔍": "1f50d",
  "🎂": "1f382",
  "🚫": "1f6ab",
  "👀": "1f440",
  "✅": "2705",
  "🎯": "1f3af",
  "⏱": "23f1-fe0f",
  "📅": "1f4c5",
  "🚩": "1f6a9",
};
