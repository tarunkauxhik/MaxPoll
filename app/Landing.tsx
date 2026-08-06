import Link from "next/link";
import { SignInButton } from "./SignInButton";
import { IncognitoIcon } from "@/components/ui/IncognitoIcon";
import { Emoji } from "@/components/ui/Emoji";
import { n, shortLeft, plural } from "@/lib/format";

export type LivePoll = {
  slug: string;
  title: string;
  votes: number;
  expiresAt: string | null;
  space: string | null;
};

/**
 * Logged-out landing — doc 04 §6.
 *
 * **The hero IS the product**: a working leaderboard with a gap line, not a
 * headline about one. Someone who has never heard of MaxPoll should understand
 * it from the shape of the thing before reading a word.
 *
 * Everything under the hero exists to answer the three questions a stranger
 * actually has, in the order they have them: *is this real* (live polls from the
 * database), *what do I do* (four steps), *what happens to me* (votes are
 * public, 18+, no password). Claims are last, proof is first.
 */
export function Landing({
  stats,
  live,
}: {
  /** Real aggregates, or null when there isn't enough data to be honest about. */
  stats: { votes: number; polls: number; spaces: number } | null;
  /** Real live polls. Empty on a cold database, and the section then disappears. */
  live: LivePoll[];
}) {
  return (
    <div className="lander">
      <header className="lnav">
        <div className="wordmark">
          Max<i>Poll</i>
        </div>
        <SignInButton label="Log in" variant="sec" className="btn sec sm" />
      </header>

      <section className="lhero">
        {/* Only shown when the number is real. 01-product: real aggregates only —
            an invented "12,400 votes" is the fastest way to lose the one thing
            a public voting product has to have. */}
        <p className="eyebrow">
          <span className="livedot" aria-hidden="true" />
          {stats ? (
            <>
              <span className="num">{n(stats.votes)}</span> votes cast
            </>
          ) : (
            "Live now · India"
          )}
        </p>

        <h1 className="t-hero">
          Everyone has an opinion.
          <br />
          Now there&apos;s a <i>scoreboard</i>.
        </h1>
        <p className="lsub">
          Make a poll about anything. Watch names climb live. Every vote is on the
          record.
        </p>

        {/* Static demo — clearly a sample, never presented as live data. The bars
            animate in via scaleX, so with animations off they are already at
            their final width rather than collapsed to nothing. */}
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
            <span aria-hidden="true">↑</span>
            <span>
              <b className="num">17 votes</b> behind Verma Ma&apos;am. Share to close
              the gap.
            </span>
          </div>
        </div>

        <SignInButton label="Continue with Google" className="btn pri fullw" />
        <p className="hint lcenter">18+ · No password, ever · Free</p>
      </section>

      {live.length > 0 && (
        <section className="lproof">
          <h2 className="t-label">
            <span className="livedot" aria-hidden="true" />
            Live right now
          </h2>
          <div className="lpolls">
            {live.map((p) => (
              <a key={p.slug} className="lpoll" href={`/p/${p.slug}`}>
                <span className="meta">
                  <span className="livedot" aria-hidden="true" />
                  {p.space ?? "MaxPoll"}
                </span>
                <span className="ttl">{p.title}</span>
                <span className="foot">
                  <b className="num">{plural(p.votes, "vote")}</b>
                  <span aria-hidden="true">·</span>
                  <span>
                    {shortLeft(p.expiresAt ? new Date(p.expiresAt).getTime() : null)}
                  </span>
                </span>
              </a>
            ))}
          </div>
        </section>
      )}

      <section className="lchat">
        <div className="lchatcard">
          <span className="ic" aria-hidden="true">
            <IncognitoIcon size={26} />
          </span>
          <div>
            <h2 className="ttl">Every poll has a chat room. Nobody sees your name.</h2>
            <p className="sub">
              Say what you actually think — everyone gets a random handle, never
              their real name.
            </p>
          </div>
        </div>
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
          <Emoji char="🔓" />
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

      {/**
       * Sticky CTA. It is the only thing on this page that matters, and on a
       * phone the hero button is off-screen for most of the scroll.
       *
       * Revealed by a scroll-driven animation rather than a scroll listener —
       * zero JS, same mechanism as the top bar's shadow. Browsers without
       * `animation-timeline` simply show it from the start, which is the correct
       * fallback: a visible CTA is never the failure mode. `prefers-reduced-
       * motion` lands in the same place.
       */}
      <div className="lsticky">
        <SignInButton label="Continue with Google" className="btn pri fullw" />
      </div>
    </div>
  );
}
