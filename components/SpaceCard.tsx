import { monogram, n } from "@/lib/format";
import { SPACE_UNLOCK_MEMBERS as UNLOCK } from "@/lib/space";

/**
 * Deterministic fill from the name — same Space, same colour, every render, with
 * no colour column and no storage.
 *
 * The hue is confined to a 50° band around the brand indigo, for two reasons
 * that the old full-wheel version got wrong on both counts:
 *
 *   1. **Colour has one job each** (CLAUDE.md). A free hue wheel put an olive
 *      tile next to a gold rank-1 badge and an indigo movement chip, and the
 *      page stopped reading as one system.
 *   2. It was **not** actually legible. The old comment claimed fixed
 *      saturation and lightness made it safe under white text; at `46% 42%` the
 *      wheel bottoms out at **2.90:1 around hue 60**, so any Space whose name
 *      hashed into the yellows rendered white-on-yellow. Measured, not guessed.
 *
 * This band's worst case is 7.5:1 — see DECISIONS D15 on why every accent is a
 * family rather than a free choice.
 */
const HUE_FROM = 214; // blue
const HUE_SPAN = 50; // …through to indigo, where --brand sits

export function tint(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return `hsl(${HUE_FROM + (h % HUE_SPAN)} 45% 36%)`;
}

export function SpaceCard({
  space,
  showProgress = false,
}: {
  space: { slug: string; name: string; description?: string | null; member_count: number };
  showProgress?: boolean;
}) {
  const pct = Math.min(100, (space.member_count / UNLOCK) * 100);
  const growing = space.member_count < UNLOCK;

  return (
    <a className="scard" href={`/s/${space.slug}`}>
      <span className="av" style={{ background: tint(space.name) }} aria-hidden="true">
        {monogram(space.name)}
      </span>

      <span className="sbody">
        <span className="stop">
          <span className="snm">{space.name}</span>
          {showProgress && growing && <span className="growing">GROWING</span>}
        </span>
        <span className="ssub">
          <span className="num">{n(space.member_count)}</span>{" "}
          {space.member_count === 1 ? "member" : "members"}
          {showProgress && growing && (
            <>
              {" · "}
              <span className="num">{space.member_count}</span>/
              <span className="num">{UNLOCK}</span> to unlock results
            </>
          )}
        </span>
        {showProgress && growing && (
          <span className="progress">
            <i style={{ width: `${pct}%` }} />
          </span>
        )}
      </span>
    </a>
  );
}
