import { cn } from "@/lib/cn";
import { n, unit } from "@/lib/format";

/**
 * The board row — doc 04-design.md §5.1, the most important component.
 *
 * A <button>, not a div: it's the primary action of the whole product and has
 * to be keyboard-reachable. The mockups used a clickable div.
 *
 * Pre-vote, counts are hidden — `pct` and `votes` are simply omitted, which is
 * what makes voting feel like unlocking.
 */
export default function OptionRow({
  rank,
  label,
  votes,
  pct,
  movement,
  variant,
  mine,
  onSelect,
  disabled,
}: {
  rank: number;
  label: string;
  votes?: number;
  pct?: number;
  /** Positive = climbed, negative = dropped, "new" = just added. */
  movement?: number | "new";
  variant?: "small";
  mine?: boolean;
  onSelect?: () => void;
  disabled?: boolean;
}) {
  const gold = rank === 1;

  return (
    <button
      type="button"
      className={cn("opt", gold && "g1", mine && "mine", variant === "small" && "sm")}
      onClick={onSelect}
      disabled={disabled}
    >
      {pct !== undefined && <span className="fill" style={{ width: `${pct}%` }} />}

      <span className="rk num">{String(rank).padStart(2, "0")}</span>

      <span className="body">
        <span className="nm">
          {label}
          {mine && <span className="tagme">Your pick</span>}
        </span>
        {(votes !== undefined || movement !== undefined) && (
          <span className="sub">
            {votes !== undefined && (
              <span>
                <span className="num">{n(votes)}</span> {unit(votes, "vote")}
              </span>
            )}
            <Movement value={movement} />
          </span>
        )}
      </span>

      {pct !== undefined && <span className="pct num">{pct}%</span>}
    </button>
  );
}

function Movement({ value }: { value?: number | "new" }) {
  if (value === undefined || value === 0) return null;
  if (value === "new") return <span className="mv new">NEW</span>;

  const up = value > 0;
  return (
    <span className={cn("mv", up ? "up" : "dn")}>
      {up ? "▲" : "▼"}
      {Math.abs(value)}
    </span>
  );
}
