import { notFound } from "next/navigation";
import AppShell from "@/components/shell/AppShell";
import { PollCard } from "@/components/poll/PollCard";
import { EmptyState } from "@/components/ui/States";
import { FollowButton } from "./FollowButton";
import { createClient, getUser } from "@/lib/supabase/server";
import { buildFeedPolls, type PollRow, type RankInput } from "@/lib/poll-queries";
import { n } from "@/lib/format";

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  return { title: `@${handle} · MaxPoll` };
}

/**
 * Public profile — doc 03 §J. **No profile photo**: no storage cost, no
 * moderation surface, no compression problem, and it forces status to come from
 * badges, which is the point.
 */
export default async function ProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const supabase = await createClient();
  const me = await getUser();

  // `dob` is deliberately not selected. It gates 18+ at write time and is never
  // displayed — pulling it here would leak it into the page payload.
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, handle, display_name, bio, instagram, x_handle, snapchat, created_at")
    .eq("handle", handle.toLowerCase())
    .maybeSingle();

  if (!profile) notFound();

  const [{ data: polls }, { count: followers }, { count: following }, { data: badges }, { data: rel }] =
    await Promise.all([
      supabase
        .from("polls")
        .select(
          "id, slug, title, status, vote_count, option_count, options_locked, expires_at, created_at, created_by, is_private, og_version, space:spaces(id, slug, name, member_count)"
        )
        .eq("created_by", profile.id)
        .neq("status", "removed")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("follows")
        .select("follower_id", { count: "exact", head: true })
        .eq("following_id", profile.id),
      supabase
        .from("follows")
        .select("following_id", { count: "exact", head: true })
        .eq("follower_id", profile.id),
      supabase.from("badges").select("type, period").eq("user_id", profile.id).limit(6),
      me
        ? supabase
            .from("follows")
            .select("follower_id")
            .eq("follower_id", me.id)
            .eq("following_id", profile.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const rows = polls ?? [];
  const ids = rows.map((p: { id: string }) => p.id);
  const { data: options } = ids.length
    ? await supabase
        .from("options")
        .select("id, poll_id, label, vote_count, rank_snapshot, created_at")
        .in("poll_id", ids)
        .eq("hidden", false)
        .is("merged_into", null)
    : { data: [] };

  const feed = buildFeedPolls(
    (rows as unknown as (PollRow & { space: PollRow["space"] | PollRow["space"][] })[]).map(
      (p) => ({ ...p, space: Array.isArray(p.space) ? (p.space[0] ?? null) : p.space })
    ),
    (options ?? []) as RankInput[],
    // Every poll here is one this person created, so previews are never masked.
    new Set(rows.map((p: { id: string }) => p.id))
  );

  const socials = [
    profile.instagram && { k: "Instagram", v: profile.instagram },
    profile.x_handle && { k: "X", v: profile.x_handle },
    profile.snapchat && { k: "Snapchat", v: profile.snapchat },
  ].filter(Boolean) as { k: string; v: string }[];

  return (
    <AppShell>
      <div className="feed prof">
        <h1 className="t-title">{profile.display_name}</h1>
        <p className="phandle">@{profile.handle}</p>
        {profile.bio && <p className="pbio">{profile.bio}</p>}

        {socials.length > 0 && (
          <div className="chips">
            {socials.map((s) => (
              <span key={s.k} className="socialchip">
                {s.k} · {s.v}
              </span>
            ))}
          </div>
        )}

        {(badges ?? []).length > 0 && (
          <div className="chips">
            {(badges ?? []).map((b: { type: string; period: string | null }, i: number) => (
              <span key={i} className={b.type === "top_creator" ? "badgechip gold" : "badgechip"}>
                {b.type === "top_creator" ? "🏆 Top creator" : "🎯 Added a winner"}
                {b.period && ` · ${b.period}`}
              </span>
            ))}
          </div>
        )}

        <div className="statrow">
          <div>
            <span className="v num">{n(followers ?? 0)}</span>
            <span className="k">Followers</span>
          </div>
          <div>
            <span className="v num">{n(following ?? 0)}</span>
            <span className="k">Following</span>
          </div>
          <div>
            <span className="v num">{n(rows.length)}</span>
            <span className="k">Polls</span>
          </div>
        </div>

        {me && me.id !== profile.id && (
          <FollowButton targetId={profile.id} following={!!rel} />
        )}
        {me && me.id === profile.id && (
          <a className="btn sec fullw" href="/settings">
            Edit profile
          </a>
        )}
      </div>

      <div className="feed">
        <h2 className="t-label">Created</h2>
      </div>
      {feed.length === 0 ? (
        <EmptyState icon="🗳️" message="No polls yet." />
      ) : (
        <div className="feed">
          {feed.map((p) => (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            <PollCard key={p.id} poll={p as any} />
          ))}
        </div>
      )}
    </AppShell>
  );
}
