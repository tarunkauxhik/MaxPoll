import Link from "next/link";

/**
 * Sticky top bar.
 * `right` is the slot the activity bell fills in Phase 7; leaving it a slot
 * avoids shipping a dead button before there is any activity to count.
 */
export default function TopBar({ right }: { right?: React.ReactNode }) {
  return (
    <header className="top">
      <Link href="/" className="wordmark" aria-label="MaxPoll home">
        Max<i>Poll</i>
      </Link>
      <span className="spacer" />
      {right}
    </header>
  );
}
