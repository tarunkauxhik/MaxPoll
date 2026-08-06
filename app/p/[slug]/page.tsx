import { notFound } from "next/navigation";
import AppShell from "@/components/shell/AppShell";
import { Board } from "@/components/poll/Board";
import { Timer } from "@/components/poll/Timer";
import { ShareButton } from "@/components/poll/ShareButton";
import { AddOption } from "@/components/poll/AddOption";
import { ManagePoll } from "@/components/poll/ManagePoll";
import { ReportButton } from "@/components/poll/ReportButton";
import { EmptyState } from "@/components/ui/States";
import {
  getPollBySlug,
  getBoard,
  getMyVote,
  hasEntitlement,
  isSpaceMember,
  isExpired,
} from "@/lib/poll-queries";
import { getUser } from "@/lib/supabase/server";
import { resultsLocked, SPACE_UNLOCK_MEMBERS } from "@/lib/space";
import { raceGap } from "@/lib/rank";
import { n, shortLeft, endingSoon, unit } from "@/lib/format";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const poll = await getPollBySlug(slug);

  /**
   * ⚠️ **Do not add a `loading.tsx` to this segment.** It was tried and reverted.
   *
   * A `loading.tsx` wraps the whole segment in Suspense, so the page renders
   * inside a stream — and once streaming starts the `200` is on the wire and
   * cannot be changed (Next 16 streaming guide, "The HTTP contract"). Every
   * mangled poll link, which is the most likely bad link in this product, then
   * answers **200** instead of 404. Measured, both ways.
   *
   * Moving `notFound()` up here does **not** rescue it — also measured. The only
   * fixes are no segment-level boundary, or a `<Suspense>` around the board
   * alone, and at ~267ms TTFB the skeleton is not worth that refactor.
   *
   * `getPollBySlug` is React-`cache()`d, so the page's own call costs nothing.
   */
  if (!poll) notFound();

  const board = await getBoard(poll.id, poll.vote_count);
  const leader = board[0];

  const description = leader
    ? `${leader.label} leading · ${n(poll.vote_count)} votes · ${shortLeft(
        poll.expires_at ? new Date(poll.expires_at).getTime() : null
      )}. Add your own name.`
    : "Be the first to vote. Add your own name.";

  return {
    title: `${poll.title} · MaxPoll`,
    description,
    /**
     * A poll answers to two URLs — its readable slug and its short code. Without
     * this, search engines see two pages with identical content and split the
     * ranking between them. The readable one wins because it is the one worth
     * indexing.
     */
    alternates: { canonical: `/p/${poll.slug}` },
    openGraph: {
      title: poll.title,
      description,
      // Versioned on leader change — WhatsApp caches previews hard and a stale
      // one makes a live poll look dead (doc 04 §5.16).
      images: [`/og/${poll.slug}?v=${poll.og_version}`],
    },
  };
}

export default async function PollPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const poll = await getPollBySlug(slug);

  // RLS deliberately still returns removed polls so this page can tell
  // "was removed" apart from "never existed" — DECISIONS, polls_read.
  if (!poll) notFound();
  if (poll.status === "removed") {
    return (
      <AppShell>
        <EmptyState icon="🚫" message="This poll was removed." />
      </AppShell>
    );
  }

  const user = await getUser();
  const expiresAt = poll.expires_at ? new Date(poll.expires_at).getTime() : null;

  const [board, myVote, entitled, member, expired, soon] = await Promise.all([
    getBoard(poll.id, poll.vote_count),
    getMyVote(poll.id, user?.id),
    hasEntitlement(poll.id, user?.id),
    poll.space ? isSpaceMember(poll.space.id, user?.id) : Promise.resolve(true),
    // Awaited alongside the data so the clock is read in the data phase, not
    // during render — components must be pure.
    Promise.resolve(isExpired(poll)),
    Promise.resolve(endingSoon(expiresAt)),
  ]);

  const spaceLocked = resultsLocked(poll);

  return (
    <AppShell>
      <div className="feed pollhead">
        {poll.space && (
          <a className="t-label spacelink" href={`/s/${poll.space.slug}`}>
            {!expired && <span className="livedot" aria-hidden="true" />}
            {poll.space.name}
          </a>
        )}
        <h1 className="t-title">{poll.title}</h1>

        <div className="counts">
          <span className="chip">
            🗳️ <span className="num">{n(poll.vote_count)}</span>{" "}
            {unit(poll.vote_count, "vote")}
          </span>
          <span className="chip">
            👥 <span className="num">{n(poll.option_count)}</span>{" "}
            {unit(poll.option_count, "option")}
          </span>
          {/* Red is time pressure only — CLAUDE.md. Every live poll used to get
              the hot chip, so red meant "live" and nothing meant "closing". */}
          <span className={soon ? "chip hot" : "chip"}>⏳ {shortLeft(expiresAt)}</span>
        </div>
      </div>

      {poll.expires_at && (
        <Timer expiresAt={poll.expires_at} startedAt={poll.created_at} />
      )}

      {board.length === 0 ? (
        <EmptyState icon="🗳️" message="Nobody's been added yet. Add the first name." />
      ) : (
        <Board
          pollId={poll.id}
          slug={poll.slug}
          initial={board}
          myOptionId={myVote}
          entitled={entitled}
          isMember={member}
          spaceId={poll.space?.id ?? null}
          spaceName={poll.space?.name ?? null}
          spaceMembers={poll.space?.member_count ?? 0}
          signedIn={!!user}
          closed={expired}
          voteCount={poll.vote_count}
          /**
           * The 20-member gate hides **results**, never the ballot. It used to
           * replace the board outright, which deadlocked the product: a Space is
           * joined by voting (03 §I, "implicit on first vote"), so with no
           * options to tap, member_count could never reach 20 — and a poll link
           * is the only link that travels.
           */
          resultsLocked={spaceLocked}
        />
      )}

      {/* Below the board, not above it: it answers "where are the numbers?"
          after the tap, instead of pushing the ballot off a phone screen. */}
      {spaceLocked && <SpaceGate space={poll.space!} />}

      {poll.vote_count > 0 && poll.vote_count < 10 && !spaceLocked && (
        <p className="hint lcenter">Results firm up at 10 votes.</p>
      )}

      {!expired && !poll.options_locked && (
        <AddOption pollId={poll.id} slug={poll.slug} signedIn={!!user} />
      )}

      <div className="pollfoot">
        <a className="btn sec" href={`/p/${poll.slug}/chat`}>
          💬 Poll chat
        </a>
        <ShareButton
          code={poll.code}
          title={poll.title}
          leader={board[0]?.label ?? null}
          /* The gap is a result, so it stays behind the Space gate like every
             other number on this page. */
          gap={spaceLocked ? null : (raceGap(board)?.lead ?? null)}
        />
        {/* Rendered only for the owner, but that is presentation — update_poll()
            and delete_poll() take identity from auth.uid(), so hiding the button
            is not what stops anyone else. */}
        {user && poll.created_by === user.id && (
          <ManagePoll
            pollId={poll.id}
            slug={poll.slug}
            title={poll.title}
            closed={expired}
            optionsLocked={poll.options_locked}
            hasVotes={poll.vote_count > 0}
            hasExpiry={poll.expires_at !== null}
          />
        )}
      </div>

      <p className="discl">
        <span aria-hidden="true">🔓</span>
        <span>Votes on MaxPoll are public. Your name is visible on this poll.</span>
      </p>

      <div className="pollmeta">
        <ReportButton
          targetType="poll"
          targetId={poll.id}
          label={poll.title}
          signedIn={!!user}
          returnTo={`/p/${poll.slug}`}
        />
      </div>
    </AppShell>
  );
}

/**
 * Under 20 members the Space can't show results yet — 03-ux-flows C.
 *
 * Voting still works; this only explains the missing numbers. The copy says so,
 * because a lock icon next to a board with no counts otherwise reads as "you
 * can't take part", which is the opposite of what the gate is for.
 */
function SpaceGate({ space }: { space: { name: string; member_count: number } }) {
  const pct = Math.min(100, (space.member_count / SPACE_UNLOCK_MEMBERS) * 100);
  return (
    <div className="state">
      <div className="ic" aria-hidden="true">
        🔒
      </div>
      <p>
        Your vote counts. Results show at{" "}
        <span className="num">{SPACE_UNLOCK_MEMBERS}</span> members —{" "}
        <span className="num">{space.member_count}</span> so far.
      </p>
      <div className="progress" role="img" aria-label={`${space.member_count} of ${SPACE_UNLOCK_MEMBERS} members`}>
        <i style={{ width: `${pct}%` }} />
      </div>
      <p className="hint">Invite people from {space.name} and results appear for everyone.</p>
    </div>
  );
}
