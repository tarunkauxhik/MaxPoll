import { n, shortLeft, plural, unit } from "@/lib/format";
import { raceGap } from "@/lib/rank";
import type { FeedPoll } from "@/lib/poll-queries";
import { cn } from "@/lib/cn";

/**
 * doc 04 §5.5. The whole card is one `<a>` — it's a single destination, so it
 * gets a single tap target rather than a div with a click handler.
 *
 * **Unvoted polls hide the names**: `🔒 vote to reveal` with a zero-width bar.
 * That gap between "340 votes happened" and "you can't see who" is the thing
 * that makes people tap.
 */
export function PollCard({ poll }: { poll: FeedPoll }) {
  const expires = poll.expires_at ? new Date(poll.expires_at).getTime() : null;
  const closed = poll.expired; // resolved server-side; render stays pure
  const lead = poll.preview[0]?.votes ?? 0;

  /**
   * The gap, on the card. `gapAbove` needs an option id and the feed does not
   * know which one is yours, so this is the top-two race — the same hook the
   * share text and the WhatsApp preview use.
   *
   * Only once you have voted, because it names a vote count, and the names are
   * hidden until then anyway.
   */
  const race = poll.voted && !closed ? raceGap(poll.preview) : null;

  return (
    <a
      className={cn("pcard", poll.endingSoon && !closed && "soon")}
      href={`/p/${poll.slug}`}
    >
      {poll.space && (
        <div className="space">
          {!closed && <span className="livedot" aria-hidden="true" />}
          {poll.space.name}
        </div>
      )}

      <h3 className="t-card">{poll.title}</h3>

      <div className="counts">
        <span className="chip">
          🗳️ <span className="num">{n(poll.vote_count)}</span>{" "}
          {unit(poll.vote_count, "vote")}
        </span>
        <span className="chip">
          👥 <span className="num">{n(poll.option_count)}</span>{" "}
          {unit(poll.option_count, "option")}
        </span>
        {/**
         * Red is time pressure only — CLAUDE.md. This used to be `.chip.hot` on
         * every live poll, which made red mean "this poll exists" and left
         * nothing on any screen saying which one is actually about to close.
         */}
        <span className={cn("chip", poll.endingSoon && !closed && "hot")}>
          ⏳ {shortLeft(expires)}
        </span>
      </div>

      {poll.preview.length > 0 && (
        <div className="mini">
          {poll.preview.map((o) => (
            <div key={o.id} className={cn("mrow", o.rank === 1 && "g")}>
              <span className="r num">{o.rank}</span>
              <span className="nm">{poll.voted ? o.label : "🔒 vote to reveal"}</span>
              <span className="bar">
                <i
                  style={{
                    width: poll.voted && lead > 0 ? `${(o.votes / lead) * 100}%` : "0%",
                  }}
                />
              </span>
            </div>
          ))}
        </div>
      )}

      {race && race.lead <= 5 && (
        <p className="cardgap">
          🔥 <b className="num">{plural(race.lead, "vote")}</b> between {race.leader} and{" "}
          {race.runnerUp}
        </p>
      )}
    </a>
  );
}
