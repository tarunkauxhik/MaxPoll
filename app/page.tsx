import AppShell from "@/components/shell/AppShell";
import OptionRow from "@/components/ui/OptionRow";
import { BoardSkeleton, EmptyState, ErrorState } from "@/components/ui/States";

/**
 * Phase 1 harness. Renders one of each primitive so Gate 1 is verifiable
 * rather than assumed — tokens resolve, `.num` is tabular, the live dot and
 * shimmer respect reduced motion, option rows are keyboard-reachable, and the
 * nav doesn't cover the last row.
 *
 * Replaced by the real feed in Phase 7.
 */
export default function Page() {
  return (
    <AppShell>
      <div className="feed">
        <div className="t-label">Shell check · phase 1</div>
        <h1 className="t-title">Best 1st year teacher</h1>
        <div className="counts">
          <span className="chip">
            🗳️ <span className="num">340</span> votes
          </span>
          <span className="chip">
            👥 <span className="num">28</span> options
          </span>
          <span className="chip hot">
            ⏳ <span className="num">4h</span> left
          </span>
        </div>
      </div>

      {/* Board — aria-live so rank changes are announced when it goes live */}
      <div className="board" aria-live="polite">
        <OptionRow rank={1} label="Rajma Sir" votes={116} pct={34} />
        <OptionRow rank={2} label="Verma Ma'am" votes={82} pct={24} movement={1} />
        <OptionRow rank={3} label="Anand Sir" votes={65} pct={19} movement={-1} mine />
      </div>

      <div className="gap">
        ↑ <b>17 votes</b> behind Verma Ma&apos;am. Share to close the gap.
      </div>

      {/* Density check: the longest realistic name + badge + percentage.
          At 360px the name must ellipsis, and nothing else may shrink. */}
      <div className="board">
        <OptionRow
          rank={4}
          label="Dr. Priyadarshini Venkataraman (Chemistry)"
          votes={44}
          pct={13}
          movement="new"
        />
      </div>

      <div className="board" aria-hidden="true">
        <OptionRow rank={6} label="Locked variant" pct={8} variant="small" />
      </div>

      <div className="feed">
        <div className="t-label">Loading</div>
      </div>
      <BoardSkeleton rows={3} />

      <div className="feed">
        <div className="t-label">Empty &amp; error</div>
      </div>
      <EmptyState icon="🗳️" message="No polls yet. Be the first — it takes 30 seconds." />
      <ErrorState message="Couldn't load the board." />

      <div className="feed">
        <div className="pcard">
          <div className="space">
            <span className="livedot" /> DTU · 1st year
          </div>
          <h2 className="t-card">Live dot + poll card</h2>
          <div className="mini">
            <div className="mrow g">
              <span className="r num">1</span>
              <span className="nm">Rajma Sir</span>
              <span className="bar">
                <i style={{ width: "88%" }} />
              </span>
            </div>
            <div className="mrow">
              <span className="r num">2</span>
              <span className="nm">Verma Ma&apos;am</span>
              <span className="bar">
                <i style={{ width: "61%" }} />
              </span>
            </div>
          </div>
        </div>

        <p className="t-sec">
          Tabular check — these rows must be exactly the same width:
          <br />
          <span className="num">1111111111</span>
          <br />
          <span className="num">8888888888</span>
        </p>

        <input className="field" placeholder="Add someone missing" aria-label="Add an option" />

        <button className="btn pri">Primary</button>
        <button className="btn sec">Secondary</button>
        <button className="btn vio">Pay ₹9 with UPI</button>

        <div className="discl">
          🔓 <span>Votes on MaxPoll are public. Your name will be visible on this poll.</span>
        </div>
      </div>
    </AppShell>
  );
}
