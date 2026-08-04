"use client";

import { countdown } from "@/lib/format";
import { useNow } from "@/lib/use-now";
import { cn } from "@/lib/cn";

/**
 * doc 04 §5.3 — the inverted dark block, the only dark element on a paper page,
 * so it pulls the eye without adding colour noise.
 *
 * Rendered from `expiresAt` on the client because it ticks. The server sends the
 * timestamp, never a formatted string: a server-formatted "04:12:07" would be
 * stale by the time it painted and would mismatch on hydration.
 */
export function Timer({
  expiresAt,
  startedAt,
}: {
  expiresAt: string;
  startedAt: string;
}) {
  const end = new Date(expiresAt).getTime();
  const start = new Date(startedAt).getTime();

  // Server-rendered from the poll's start time so the SSR HTML is deterministic,
  // then ticks once mounted.
  const now = useNow(start);

  const { text, urgent, expired, elapsed } = countdown(end, now, start);

  // 2πr with r=14 ≈ 88, matching the stroke-dasharray in the design.
  const DASH = 88;

  return (
    <div className={cn("timerbar", urgent && "urgent")}>
      <span className="ring" aria-hidden="true">
        <svg viewBox="0 0 34 34" width="34" height="34">
          <circle cx="17" cy="17" r="14" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="3" />
          <circle
            cx="17"
            cy="17"
            r="14"
            fill="none"
            stroke="var(--gold)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={DASH}
            strokeDashoffset={DASH * elapsed}
          />
        </svg>
        <span className="t num">{Math.max(0, Math.round((1 - elapsed) * 100))}</span>
      </span>

      <span className="lab">
        <span className="k">{expired ? "VOTING CLOSED" : "VOTING CLOSES IN"}</span>
        {/* aria-live off: a screen reader announcing every second is unusable.
            The closed state is announced by the board's own live region. */}
        <span className="v num" aria-hidden={!expired}>
          {colourColons(text)}
        </span>
      </span>

      <span className="em" aria-hidden="true">
        ⏳
      </span>
      <span className="prog" style={{ width: `${Math.max(0, (1 - elapsed) * 100)}%` }} />
    </div>
  );
}

/** Colons in gold — doc 04 §5.3. Splitting keeps the digits in tabular figures. */
function colourColons(text: string) {
  return text.split(":").flatMap((part, i) =>
    i === 0 ? [part] : [<em key={i}>:</em>, part]
  );
}
