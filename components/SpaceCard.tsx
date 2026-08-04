import { monogram, n } from "@/lib/format";

const UNLOCK = 20;

/** Deterministic fill from the name — same Space, same colour, every render,
 *  with no colour column and no storage. Hue only; saturation and lightness are
 *  fixed so nothing can come out clashing or illegible under white text. */
function tint(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return `hsl(${h} 46% 42%)`;
}

/** doc 04 §5.13. */
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
