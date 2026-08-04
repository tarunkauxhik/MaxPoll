import { n, shortLeft } from "@/lib/format";
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

  return (
    <a className="pcard" href={`/p/${poll.slug}`}>
      {poll.space && (
        <div className="space">
          {!closed && <span className="livedot" aria-hidden="true" />}
          {poll.space.name}
        </div>
      )}

      <h3 className="t-card">{poll.title}</h3>

      <div className="counts">
        <span className="chip">
          🗳️ <span className="num">{n(poll.vote_count)}</span> votes
        </span>
        <span className="chip">
          👥 <span className="num">{n(poll.option_count)}</span> options
        </span>
        <span className={closed ? "chip" : "chip hot"}>⏳ {shortLeft(expires)}</span>
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
    </a>
  );
}
