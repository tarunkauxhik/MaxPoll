import { notFound } from "next/navigation";
import AppShell from "@/components/shell/AppShell";
import { PollCard } from "@/components/poll/PollCard";
import { EmptyState } from "@/components/ui/States";
import { JoinButton } from "./JoinButton";
import { createClient, getUser } from "@/lib/supabase/server";
import { buildFeedPolls, getSpaceByKey, type PollRow, type RankInput } from "@/lib/poll-queries";
import { monogram, n } from "@/lib/format";
import { SPACE_UNLOCK_MEMBERS as UNLOCK } from "@/lib/space";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const space = await getSpaceByKey(slug);
  if (!space) return { title: "Space · MaxPoll" };

  const description = `${space.member_count} members · ${
    space.description ?? "Polls that settle arguments."
  }`;

  return {
    title: `${space.name} · MaxPoll`,
    description,
    // Space links travel in group chats exactly like poll links do. Without
    // this the preview was a bare title and no image.
    alternates: { canonical: `/s/${space.slug}` },
    openGraph: {
      title: space.name,
      description,
      images: [`/og/s/${space.slug}`],
    },
  };
}

export default async function SpacePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const user = await getUser();

  const space = await getSpaceByKey(slug);

  if (!space) notFound();

  const [{ data: polls }, { data: membership }] = await Promise.all([
    supabase
      .from("polls")
      .select(
        "id, slug, code, title, status, vote_count, option_count, options_locked, expires_at, created_at, created_by, is_private, og_version"
      )
      .eq("space_id", space.id)
      .neq("status", "removed")
      .order("created_at", { ascending: false })
      .limit(30),
    user
      ? supabase
          .from("space_members")
          .select("space_id")
          .eq("space_id", space.id)
          .eq("user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const rows = (polls ?? []) as Omit<PollRow, "space">[];
  const ids = rows.map((p) => p.id);

  const [{ data: options }, { data: myVotes }] = await Promise.all([
    ids.length
      ? supabase
          .from("options")
          .select("id, poll_id, label, vote_count, rank_snapshot, created_at")
          .in("poll_id", ids)
          .eq("hidden", false)
          .is("merged_into", null)
      : Promise.resolve({ data: [] }),
    user && ids.length
      ? supabase.from("votes").select("poll_id").eq("user_id", user.id).in("poll_id", ids)
      : Promise.resolve({ data: [] as { poll_id: string }[] }),
  ]);

  const votedOn = new Set((myVotes ?? []).map((v: { poll_id: string }) => v.poll_id));
  const spaceRef = {
    id: space.id,
    slug: space.slug,
    code: space.code,
    name: space.name,
    member_count: space.member_count,
  };

  const feed = buildFeedPolls(
    rows.map((p) => ({ ...p, space: spaceRef })),
    (options ?? []) as RankInput[],
    votedOn
  );

  const growing = space.member_count < UNLOCK;

  return (
    <AppShell>
      <div className="feed spacehead">
        <div className="shead">
          <span className="av lg" aria-hidden="true">
            {monogram(space.name)}
          </span>
          <div>
            <h1 className="t-card">
              {space.name}
              {space.is_verified && (
                <span className="verified" title="Verified">
                  ✓
                </span>
              )}
            </h1>
            <p className="t-sec">
              <span className="num">{n(space.member_count)}</span> members ·{" "}
              <span className="num">{n(rows.length)}</span> polls
            </p>
          </div>
        </div>

        <p className="sdesc">{space.description}</p>

        {growing && (
          <div className="growbox">
            <p className="t-sec">
              <span className="num">{space.member_count}</span>/
              <span className="num">{UNLOCK}</span> members to unlock results
            </p>
            <span className="progress">
              <i style={{ width: `${(space.member_count / UNLOCK) * 100}%` }} />
            </span>
          </div>
        )}

        {user && (
          <JoinButton spaceId={space.id} slug={space.slug} joined={!!membership} />
        )}
      </div>

      {feed.length === 0 ? (
        <EmptyState
          icon="🗳️"
          message="No polls yet. Be the first — it takes 30 seconds."
          action={
            <a className="btn pri" href="/create">
              Create a poll
            </a>
          }
        />
      ) : (
        <div className="feed">
          {feed.map((p) => (
            <PollCard key={p.id} poll={p} />
          ))}
        </div>
      )}
    </AppShell>
  );
}
