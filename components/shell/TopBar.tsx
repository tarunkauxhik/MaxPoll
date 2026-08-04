/**
 * Sticky top bar — doc 05 §3.
 * `right` is the slot the activity bell fills in Phase 7; leaving it a slot
 * avoids shipping a dead button before there is any activity to count.
 */
export default function TopBar({ right }: { right?: React.ReactNode }) {
  return (
    <header className="top">
      <span className="wordmark">
        Max<i>Poll</i>
      </span>
      <span className="spacer" />
      {right}
    </header>
  );
}
