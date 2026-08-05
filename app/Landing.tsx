import Link from "next/link";
import { SignInButton } from "./SignInButton";
import { n } from "@/lib/format";

/**
 * Logged-out landing — doc 04 §6.
 *
 * **The hero IS the product**: a working leaderboard with a gap line, not a
 * headline about one. Someone who has never heard of MaxPoll should understand
 * it from the shape of the thing before reading a word.
 */
export function Landing({
  stats,
}: {
  /** Real aggregates, or null when there isn't enough data to be honest about. */
  stats: { votes: number; polls: number; spaces: number } | null;
}) {
  return (
    <div className="lander">
      <header className="lnav">
        <div className="wordmark">
          Max<i>Poll</i>
        </div>
        <SignInButton label="Log in" variant="sec" />
      </header>

      <section className="lhero">
        {/* Only shown when the number is real. 01-product: real aggregates only —
            an invented "12,400 votes" is the fastest way to lose the one thing
            a public voting product has to have. */}
        {stats && (
          <p className="eyebrow">
            <span className="livedot" aria-hidden="true" />
            <span className="num">{n(stats.votes)}</span> votes cast
          </p>
        )}

        <h1 className="t-hero">
          Everyone has an opinion.
          <br />
          Now there&apos;s a <i>scoreboard</i>.
        </h1>
        <p className="lsub">
          Make a poll about anything. Watch names climb live. Every vote is on the
          record.
        </p>

        {/* Static demo — clearly a sample, never presented as live data. */}
        <div className="demo" aria-label="Example leaderboard">
          <div className="drow g1">
            <span className="r num">01</span>
            <span className="nm">Rajma Sir</span>
            <span className="bar">
              <i style={{ width: "100%" }} />
            </span>
            <span className="p num">34%</span>
          </div>
          <div className="drow">
            <span className="r num">02</span>
            <span className="nm">Verma Ma&apos;am</span>
            <span className="bar">
              <i style={{ width: "70%" }} />
            </span>
            <span className="p num">24%</span>
          </div>
          <div className="drow">
            <span className="r num">03</span>
            <span className="nm">Anand Sir</span>
            <span className="bar">
              <i style={{ width: "56%" }} />
            </span>
            <span className="p num">19%</span>
          </div>
          <div className="gap">
            ↑ <b className="num">17 votes</b> behind Verma Ma&apos;am. Share to close
            the gap.
          </div>
        </div>

        <SignInButton label="Continue with Google" />
        <p className="hint lcenter">18+ · No password, ever</p>
      </section>

      {stats && (
        <section className="lstats">
          <div>
            <span className="v num">{n(stats.votes)}</span>
            <span className="k">Votes</span>
          </div>
          <div>
            <span className="v num">{n(stats.polls)}</span>
            <span className="k">Polls</span>
          </div>
          <div>
            <span className="v num">{n(stats.spaces)}</span>
            <span className="k">Spaces</span>
          </div>
        </section>
      )}

      <section className="lhow">
        <h2 className="t-card">How it works</h2>
        <ol>
          <li>
            <span className="s num">1</span>
            <span>
              <b>Pick a Space</b> — your college, office, or anything else.
            </span>
          </li>
          <li>
            <span className="s num">2</span>
            <span>
              <b>Ask something people argue about.</b> Best teacher. Worst canteen.
            </span>
          </li>
          <li>
            <span className="s num">3</span>
            <span>
              <b>Share the link.</b> Votes land, names climb, ranks move live.
            </span>
          </li>
          <li>
            <span className="s num">4</span>
            <span>
              <b>See who voted</b> when the poll closes.
            </span>
          </li>
        </ol>
      </section>

      <footer className="lfoot">
        <p className="discl">
          <span aria-hidden="true">🔓</span>
          <span>
            Votes on MaxPoll are public. Your name will be visible on polls you vote
            in.
          </span>
        </p>
        {/* Google's OAuth Branding step needs these to resolve, and the landing
            page is where a reviewer lands. */}
        <p className="hint lcenter">
          MaxPoll · 18+ · India · <Link href="/privacy">Privacy</Link> ·{" "}
          <Link href="/terms">Terms</Link>
        </p>
      </footer>
    </div>
  );
}
