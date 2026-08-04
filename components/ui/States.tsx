/**
 * Loading, empty and error — doc 04-design.md §5.17.
 * Copy is fixed in docs/03-ux-flows.md: instructions, never apologies.
 */

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
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="state">
      <span className="ic" aria-hidden="true">
        {icon}
      </span>
      <p>{message}</p>
      {action && (
        <button type="button" className="btn pri" onClick={action.onClick}>
          {action.label}
        </button>
      )}
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
