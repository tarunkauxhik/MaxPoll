import { ImageResponse } from "next/og";
import { createAnonClient } from "@/lib/supabase/anon";
import { rankOptions, raceGap } from "@/lib/rank";
import { shortLeft, plural, n } from "@/lib/format";
import { keyFilter } from "@/lib/short-code";
import { C, OG, HEADERS, shell, row, col, Eyebrow, Hook, clip } from "../shared";

/**
 * WhatsApp preview for a poll.
 *
 * It shows the **actual leaderboard**, not a headline about one. A card that
 * says "Vote in this poll" is an advertisement; a card that shows Kohli ahead of
 * Tendulkar by four votes with three hours left is an argument, and an argument
 * is what travels between groups.
 *
 * ⚠️ RULES.md, caching: excluded from the proxy matcher and built on the anonymous
 * client, so the response carries no `Set-Cookie` and stays CDN-cacheable.
 *
 * The URL is versioned by `og_version` at the call site, because WhatsApp caches
 * previews hard and a stale one makes a live poll look dead. That counter is
 * bumped by a database trigger, not by app code — four different writers change
 * what this card says (`update_poll`, `add_option`, admin hide, the close cron)
 * and a bump in one of them would leave the other three stale.
 */
export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const filter = keyFilter(slug);
  if (!filter) return new Response("Not found", { status: 404 });

  const supabase = createAnonClient();

  const { data: poll } = await supabase
    .from("polls")
    .select("id, title, vote_count, expires_at, status, space:spaces(name)")
    .or(filter)
    .maybeSingle();

  if (!poll) return new Response("Not found", { status: 404 });

  const { data: options } = await supabase
    .from("options")
    .select("id, label, vote_count, rank_snapshot, created_at")
    .eq("poll_id", poll.id)
    .eq("hidden", false)
    .is("merged_into", null);

  const board = rankOptions(options ?? [], poll.vote_count ?? 0);
  const top = board.slice(0, 3);
  const space = Array.isArray(poll.space) ? poll.space[0] : poll.space;
  const endsAt = poll.expires_at ? new Date(poll.expires_at).getTime() : null;
  const left = shortLeft(endsAt);
  const closed = poll.status !== "live" || (endsAt !== null && endsAt <= Date.now());

  const race = raceGap(board);
  /**
   * Order matters: the tightest true statement wins. "2 votes apart" beats
   * "47 votes" beats "be the first", and an empty board must never claim a race.
   *
   * A tie gets its own line. `race.lead` is 0 when the top two are level, which
   * is a real and common state on a young poll, and it rendered as the sentence
   * "Only 0 votes apart" on every share card of one.
   */
  const hook = closed
    ? board[0]
      ? `${clip(board[0].label, 26)} won`
      : "Voting closed"
    : race && race.lead === 0
      ? "Dead heat at the top"
      : race && race.lead <= 5
        ? `Only ${plural(race.lead, "vote")} apart`
        : poll.vote_count > 0
          ? `${plural(poll.vote_count, "vote")} so far · tap to add yours`
          : "Be the first to vote";

  const accent = closed ? C.dim : race && race.lead <= 5 ? C.heat : C.gold;

  return new ImageResponse(
    (
      <div style={shell}>
        <div style={{ ...row, justifyContent: "space-between" }}>
          <Eyebrow text={space?.name ?? "MaxPoll"} live={!closed} />
          <div style={{ ...row, gap: 14, fontSize: 26, color: C.dim }}>
            <div style={{ display: "flex", fontWeight: 700, color: "#fff" }}>
              {n(poll.vote_count ?? 0)}
            </div>
            <div style={{ display: "flex" }}>votes</div>
            <div style={{ display: "flex", color: C.dimmer }}>·</div>
            <div style={{ display: "flex", color: closed ? C.dim : C.heat }}>{left}</div>
          </div>
        </div>

        <div style={{ ...col, gap: 30 }}>
          <div
            style={{
              display: "flex",
              // Two lines is the budget. Past it the board loses a row, and the
              // board is the reason the card works.
              fontSize: poll.title.length > 44 ? 52 : 62,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: -2,
            }}
          >
            {clip(poll.title, 84)}
          </div>

          {top.length > 0 && (
            <div style={{ ...col, gap: 18 }}>
              {top.map((o) => (
                <Bar
                  key={o.id}
                  rank={o.rank}
                  label={o.label}
                  pct={o.pct}
                  votes={o.votes}
                  lead={board[0].votes}
                />
              ))}
            </div>
          )}
        </div>

        <Hook text={hook} accent={accent} />
      </div>
    ),
    { ...OG, headers: HEADERS }
  );
}

/**
 * One leaderboard row. The bar is scaled against the **leader**, not against the
 * total — at 3 options and 40% / 30% / 30% every bar would otherwise be a stub,
 * and the whole point of the card is that you can see the shape of the race in
 * the half-second before you decide to tap.
 */
function Bar({
  rank,
  label,
  pct,
  votes,
  lead,
}: {
  rank: number;
  label: string;
  pct: number;
  votes: number;
  lead: number;
}) {
  const first = rank === 1;
  const width = lead > 0 ? Math.max(4, (votes / lead) * 100) : 0;

  return (
    // flex-start, not center: the rank must sit on the *name's* line. Centred
    // against the whole column it drifts down to the bar and reads misaligned.
    <div style={{ ...row, alignItems: "flex-start", gap: 22 }}>
      <div
        style={{
          display: "flex",
          width: 44,
          paddingTop: 4,
          fontSize: 28,
          fontWeight: 700,
          color: first ? C.gold : C.dim,
        }}
      >
        {String(rank).padStart(2, "0")}
      </div>

      <div style={{ ...col, flex: 1, gap: 8 }}>
        <div style={{ ...row, justifyContent: "space-between" }}>
          <div
            style={{
              display: "flex",
              fontSize: 32,
              fontWeight: first ? 700 : 500,
              color: first ? "#fff" : "rgba(255,255,255,.82)",
            }}
          >
            {clip(label, 30)}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 28,
              fontWeight: 700,
              color: first ? C.gold : C.dim,
            }}
          >
            {pct}%
          </div>
        </div>
        <div
          style={{
            display: "flex",
            height: 10,
            borderRadius: 99,
            backgroundColor: "rgba(255,255,255,.10)",
          }}
        >
          <div
            style={{
              display: "flex",
              width: `${width}%`,
              borderRadius: 99,
              backgroundColor: first ? C.gold : "rgba(255,255,255,.42)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
