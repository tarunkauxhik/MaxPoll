"use client";

import { countdown, segments } from "@/lib/format";
import { useNow } from "@/lib/use-now";
import { cn } from "@/lib/cn";

/**
 * The countdown block — one of the dark-chrome surfaces on a light page,
 * so it pulls the eye without adding colour noise.
 *
 * Rendered from `expiresAt` on the client because it ticks. The server sends the
 * timestamp, never a formatted string: a server-formatted "04:12:07" would be
 * stale by the time it painted and would mismatch on hydration.
 */
export function Timer({
  expiresAt,
  startedAt,
  closed = false,
}: {
  expiresAt: string;
  startedAt: string;
  /**
   * The server's verdict, from `isExpired()` — which reads `status` as well as
   * the clock. Without it this panel only knew about `expires_at`, so "Stop
   * voting now" (which sets `status = 'closed'` and deliberately leaves the
   * deadline alone) left a closed poll counting down "VOTING CLOSES IN 2d".
   */
  closed?: boolean;
}) {
  const end = new Date(expiresAt).getTime();
  const start = new Date(startedAt).getTime();

  // Server-rendered from the poll's start time so the SSR HTML is deterministic,
  // then ticks once mounted.
  const now = useNow(start);

  const tick = countdown(end, now, start);
  const expired = closed || tick.expired;
  const urgent = tick.urgent && !expired;
  const elapsed = tick.elapsed;
  // Closed early: the clock still has time on it, so feed `segments` an instant
  // that has already passed rather than showing a running deadline nobody can
  // vote against.
  const segs = segments(expired ? now : end, now);
  const pctLeft = Math.max(0, Math.min(100, Math.round((1 - elapsed) * 100)));

  return (
    <div
      className={cn("timerbar", urgent && "urgent", expired && "over")}
      aria-label={
        expired
          ? "Voting closed"
          : `${segs.map((s) => `${s.value} ${s.unit}`).join(" ")} left to vote, ${pctLeft}% of the window remaining`
      }
    >
      <div className="tmeta">
        <span className="k">
          {expired ? "VOTING CLOSED" : urgent ? "ENDING SOON" : "VOTING CLOSES IN"}
        </span>
        {!expired && <span className="pctleft num">{pctLeft}% left</span>}
      </div>

      <div className="tsegs" aria-hidden="true">
        {segs.map((s, i) => (
          <div key={s.unit} className={cn("tseg", urgent && i === segs.length - 1 && "pulse")}>
            <span className="v num">{s.value}</span>
            <span className="u">{s.unit}</span>
          </div>
        ))}
      </div>

      <div className="ttrack" aria-hidden="true">
        <i style={{ width: `${expired ? 0 : Math.max(0, (1 - elapsed) * 100)}%` }} />
      </div>
    </div>
  );
}
