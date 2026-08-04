import AppShell from "@/components/shell/AppShell";

/**
 * Phase 1 harness. Renders one of each primitive from globals.css so Gate 1
 * is actually verifiable — tokens resolve, `.num` is tabular, the live dot
 * respects reduced motion, and the nav doesn't cover the last row.
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

      <div className="board">
        <div className="opt g1">
          <div className="fill" style={{ width: "34%" }} />
          <span className="rk num">01</span>
          <div className="body">
            <div className="nm">Rajma Sir</div>
            <div className="sub">
              <span className="num">116</span> votes
            </div>
          </div>
          <span className="pct num">34%</span>
        </div>

        <div className="opt">
          <div className="fill" style={{ width: "24%" }} />
          <span className="rk num">02</span>
          <div className="body">
            <div className="nm">Verma Ma&apos;am</div>
            <div className="sub">
              <span className="num">82</span> votes <span className="mv up">▲1</span>
            </div>
          </div>
          <span className="pct num">24%</span>
        </div>

        <div className="opt mine">
          <div className="fill" style={{ width: "19%" }} />
          <span className="rk num">03</span>
          <div className="body">
            <div className="nm">
              Anand Sir <span className="tagme">Your pick</span>
            </div>
            <div className="sub">
              <span className="num">65</span> votes <span className="mv dn">▼1</span>
            </div>
          </div>
          <span className="pct num">19%</span>
        </div>
      </div>

      <div className="gap">
        ↑ <b>17 votes</b> behind Verma Ma&apos;am. Share to close the gap.
      </div>

      <div className="board locked" aria-hidden="true">
        <div className="opt sm">
          <span className="rk num">06</span>
          <div className="body">
            <div className="nm">Locked variant</div>
          </div>
          <span className="pct num">8%</span>
        </div>
      </div>

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
          Tabular check — these two rows must be exactly the same width:
          <br />
          <span className="num">1111111111</span>
          <br />
          <span className="num">8888888888</span>
        </p>

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
