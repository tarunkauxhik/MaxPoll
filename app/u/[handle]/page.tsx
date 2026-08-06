import { notFound } from "next/navigation";
import AppShell from "@/components/shell/AppShell";
import { PollCard } from "@/components/poll/PollCard";
import { EmptyState } from "@/components/ui/States";
import { Emoji } from "@/components/ui/Emoji";
import { createClient, getUser } from "@/lib/supabase/server";
import { buildFeedPolls, POLL_SELECT, type PollRow, type RankInput } from "@/lib/poll-queries";
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

  // Follows are gone — the table, the button and the counts. A follower count
  // that mostly reads 0 is a status symbol nobody earned, and the graph fed
  // exactly one notification type. Votes received is the number that actually
  // says something about a creator here.
  const [{ data: polls }, { data: badges }] = await Promise.all([
    supabase
      .from("polls")
      .select(POLL_SELECT)
      .eq("created_by", profile.id)
      .neq("status", "removed")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("badges").select("type, period").eq("user_id", profile.id).limit(6),
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

  const SOCIAL_URL: Record<string, (v: string) => string> = {
    Instagram: (v) => `https://instagram.com/${v.replace(/^@/, "")}`,
    X: (v) => `https://x.com/${v.replace(/^@/, "")}`,
    Snapchat: (v) => `https://snapchat.com/add/${v.replace(/^@/, "")}`,
  };

  return (
    <AppShell>
      <div className="feed prof">
        <h1 className="t-title">{profile.display_name}</h1>
        <p className="phandle">@{profile.handle}</p>
        {profile.bio && <p className="pbio">{profile.bio}</p>}

        {socials.length > 0 && (
          <div className="chips">
            {socials.map((s) => (
              <a
                key={s.k}
                className="socialchip"
                href={SOCIAL_URL[s.k](s.v)}
                target="_blank"
                rel="noopener noreferrer nofollow"
              >
                {s.k} · {s.v}
              </a>
            ))}
          </div>
        )}

        {(badges ?? []).length > 0 && (
          <div className="chips">
            {(badges ?? []).map((b: { type: string; period: string | null }, i: number) => (
              <span key={i} className={b.type === "top_creator" ? "badgechip gold" : "badgechip"}>
                {b.type === "top_creator" ? (
                  <>
                    <Emoji char="🏆" /> Top creator
                  </>
                ) : (
                  <>
                    <Emoji char="🎯" /> Added a winner
                  </>
                )}
                {b.period && ` · ${b.period}`}
              </span>
            ))}
          </div>
        )}

        <div className="statrow">
          <div>
            <span className="v num">{n(rows.length)}</span>
            <span className="k">Polls</span>
          </div>
          <div>
            {/* Sums the denormalised counters — never count(*) on votes. */}
            <span className="v num">
              {n(rows.reduce((s: number, p: { vote_count: number | null }) => s + (p.vote_count ?? 0), 0))}
            </span>
            <span className="k">Votes cast</span>
          </div>
        </div>

        {me && me.id === profile.id && (
          <div className="btnrow">
            <a className="btn sec" href="/settings#profile">
              Edit profile
            </a>
            <a className="btn sec" href="/settings#account">
              <Emoji char="⚙" /> Settings
            </a>
          </div>
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
