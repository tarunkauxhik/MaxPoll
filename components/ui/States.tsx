/**
 * Loading, empty and error. All three are required before a screen ships —
 * DECISIONS C3. Copy is fixed in docs/03-ux-flows.md: instructions, never apologies.
 */
import { Emoji } from "./Emoji";

/** Skeleton board. Rows match .opt's height exactly, so the swap to real rows
 *  causes no layout shift. */
export function BoardSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="board" aria-busy="true" aria-label="Loading the board">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skel skel-opt" />
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  message,
  action,
}: {
  icon: string;
  message: string;
  /** A ready-made <a> or <button>. A ReactNode rather than an onClick so this
   *  stays usable from Server Components, which is where most empties live. */
  action?: React.ReactNode;
}) {
  return (
    <div className="state">
      <span className="ic">
        <Emoji char={icon} />
      </span>
      <p>{message}</p>
      {action}
    </div>
  );
}

/** Errors state what happened and what to do. `role="alert"` so a screen
 *  reader announces one that appears after load. */
export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="state err" role="alert">
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="btn sec" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
