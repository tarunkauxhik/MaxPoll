import { notFound } from "next/navigation";
import AppShell from "@/components/shell/AppShell";
import { Board } from "@/components/poll/Board";
import { Timer } from "@/components/poll/Timer";
import { ShareButton } from "@/components/poll/ShareButton";
import { AddOption } from "@/components/poll/AddOption";
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
import { n, shortLeft } from "@/lib/format";
import type { Metadata } from "next";

// The Space results gate — 03-ux-flows C.
const SPACE_UNLOCK_MEMBERS = 20;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const poll = await getPollBySlug(slug);
  if (!poll) return { title: "Poll not found · MaxPoll" };

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
  const [board, myVote, entitled, member, expired] = await Promise.all([
    getBoard(poll.id, poll.vote_count),
    getMyVote(poll.id, user?.id),
    hasEntitlement(poll.id, user?.id),
    poll.space ? isSpaceMember(poll.space.id, user?.id) : Promise.resolve(true),
    // Awaited alongside the data so the clock is read in the data phase, not
    // during render — components must be pure.
    Promise.resolve(isExpired(poll)),
  ]);

  const spaceLocked =
    poll.space !== null && poll.space.member_count < SPACE_UNLOCK_MEMBERS;

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
            🗳️ <span className="num">{n(poll.vote_count)}</span> votes
          </span>
          <span className="chip">
            👥 <span className="num">{n(poll.option_count)}</span> options
          </span>
          <span className={expired ? "chip" : "chip hot"}>
            ⏳{" "}
            {shortLeft(poll.expires_at ? new Date(poll.expires_at).getTime() : null)}
          </span>
        </div>
      </div>

      {poll.expires_at && !expired && (
        <Timer expiresAt={poll.expires_at} startedAt={poll.created_at} />
      )}

      {spaceLocked ? (
        <SpaceGate space={poll.space!} />
      ) : board.length === 0 ? (
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
        />
      )}

      {poll.vote_count > 0 && poll.vote_count < 10 && !spaceLocked && (
        <p className="hint lcenter">Results firm up at 10 votes.</p>
      )}

      {!expired && !poll.options_locked && !spaceLocked && (
        <AddOption pollId={poll.id} slug={poll.slug} signedIn={!!user} />
      )}

      <div className="pollfoot">
        <a className="btn sec" href={`/p/${poll.slug}/chat`}>
          💬 Poll chat
        </a>
        <ShareButton
          slug={poll.slug}
          title={poll.title}
          leader={board[0]?.label ?? null}
        />
      </div>

      <p className="discl">
        <span aria-hidden="true">🔓</span>
        <span>Votes on MaxPoll are public. Your name is visible on this poll.</span>
      </p>
    </AppShell>
  );
}

/** Under 20 members the Space can't show results yet — 03-ux-flows C. */
function SpaceGate({ space }: { space: { name: string; member_count: number } }) {
  const pct = Math.min(100, (space.member_count / SPACE_UNLOCK_MEMBERS) * 100);
  return (
    <div className="state">
      <div className="ic" aria-hidden="true">
        🔒
      </div>
      <p>
        <span className="num">{space.member_count}</span>/
        <span className="num">{SPACE_UNLOCK_MEMBERS}</span> members to unlock results
      </p>
      <div className="progress" role="img" aria-label={`${space.member_count} of ${SPACE_UNLOCK_MEMBERS} members`}>
        <i style={{ width: `${pct}%` }} />
      </div>
      <p className="hint">Invite people from {space.name} and results appear for everyone.</p>
    </div>
  );
}
