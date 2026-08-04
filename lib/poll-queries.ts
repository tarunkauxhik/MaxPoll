import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAnonClient } from "@/lib/supabase/anon";
import { rankOptions, type BoardOption, type RankInput } from "@/lib/rank";

export type { BoardOption, RankInput };

export type PollRow = {
  id: string;
  slug: string;
  title: string;
  status: "live" | "closed" | "removed";
  vote_count: number;
  option_count: number;
  options_locked: boolean;
  expires_at: string | null;
  created_at: string;
  created_by: string | null;
  is_private: boolean;
  og_version: number;
  space: { id: string; slug: string; name: string; member_count: number } | null;
};

const SPACE_SELECT = "space:spaces(id, slug, name, member_count)";
const POLL_SELECT = `id, slug, title, status, vote_count, option_count, options_locked,
  expires_at, created_at, created_by, is_private, og_version, ${SPACE_SELECT}`;

/**
 * PostgREST returns an embedded to-one relation typed as an array (it can't know
 * the FK is single-valued without generated types). Normalised here, once, so no
 * caller has to remember `space[0]`.
 */
type RawPoll = Omit<PollRow, "space"> & {
  space: PollRow["space"] | PollRow["space"][] | null;
};

function normalise(row: RawPoll): PollRow {
  return { ...row, space: Array.isArray(row.space) ? (row.space[0] ?? null) : row.space };
}

/**
 * Is voting over? Lives in the data layer, not in a component: reading the clock
 * during render is impure, and — more usefully — it means the feed, the poll page
 * and the board route cannot disagree about whether a poll is closed.
 *
 * `status` is checked first so a manually closed or removed poll counts as over
 * regardless of its timer.
 */
export function isExpired(
  poll: Pick<PollRow, "status" | "expires_at">,
  now: number = Date.now()
): boolean {
  if (poll.status !== "live") return true;
  return poll.expires_at !== null && new Date(poll.expires_at).getTime() <= now;
}

/** Board options for a poll. Anonymous client — never touches cookies (A2). */
export async function getBoard(pollId: string, totalVotes: number) {
  const supabase = createAnonClient();
  const { data } = await supabase
    .from("options")
    .select("id, label, vote_count, rank_snapshot, created_at")
    .eq("poll_id", pollId)
    .eq("hidden", false)
    .is("merged_into", null);

  return rankOptions(data ?? [], totalVotes);
}

export async function getPollBySlug(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("polls")
    .select(POLL_SELECT)
    .eq("slug", slug)
    .maybeSingle();
  return data ? normalise(data as unknown as RawPoll) : null;
}

/** The signed-in user's vote on this poll, if any. */
export async function getMyVote(pollId: string, userId: string | undefined) {
  if (!userId) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("votes")
    .select("option_id")
    .eq("poll_id", pollId)
    .eq("user_id", userId)
    .maybeSingle();
  return data?.option_id ?? null;
}

/**
 * Does this user hold an unlock for this poll?
 *
 * RLS already hides other people's votes, so this only decides what the UI
 * *offers*. It is not the security boundary — that lives in `votes_read_entitled`,
 * and no client query can talk its way past it.
 */
export async function hasEntitlement(pollId: string, userId: string | undefined) {
  if (!userId) return false;
  const supabase = await createClient();
  const { data } = await supabase
    .from("entitlements")
    .select("id, kind, poll_id, expires_at")
    .eq("user_id", userId);

  const now = Date.now();
  return (data ?? []).some(
    (e: { kind: string; poll_id: string | null; expires_at: string | null }) =>
      (e.poll_id === pollId || e.kind === "sub_monthly") &&
      (e.expires_at === null || new Date(e.expires_at).getTime() > now)
  );
}

/** The user's active 30-day pass, if any. Reads the clock in the data layer so
 *  callers stay pure. */
export async function activePass(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("entitlements")
    .select("kind, expires_at, source")
    .eq("user_id", userId);

  const now = Date.now();
  const pass = (data ?? []).find(
    (e: { kind: string; expires_at: string | null }) =>
      e.kind === "sub_monthly" &&
      (e.expires_at === null || new Date(e.expires_at).getTime() > now)
  );
  return { pass: pass ?? null, total: (data ?? []).length };
}

export async function isSpaceMember(spaceId: string, userId: string | undefined) {
  if (!userId) return false;
  const supabase = await createClient();
  const { data } = await supabase
    .from("space_members")
    .select("space_id")
    .eq("space_id", spaceId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

export type FeedPoll = PollRow & {
  preview: BoardOption[];
  voted: boolean;
  /** Resolved server-side — see isExpired(). Cards must not read the clock. */
  expired: boolean;
};

/**
 * Turns poll rows + their options into cards. Shared by the home feed, a Space
 * page and a profile, which were each doing this by hand.
 *
 * It also owns the clock read. Components must be pure, so `expired` is resolved
 * here rather than in three different render paths that could disagree.
 */
export function buildFeedPolls(
  rows: PollRow[],
  options: RankInput[],
  votedPollIds: Set<string>,
  now: number = Date.now()
): FeedPoll[] {
  const byPoll = new Map<string, RankInput[]>();
  for (const o of options) {
    const list = byPoll.get((o as RankInput & { poll_id: string }).poll_id) ?? [];
    list.push(o);
    byPoll.set((o as RankInput & { poll_id: string }).poll_id, list);
  }

  return rows.map((p) => ({
    ...p,
    voted: votedPollIds.has(p.id),
    expired: isExpired(p, now),
    preview: rankOptions(byPoll.get(p.id) ?? [], p.vote_count).slice(0, 3),
  }));
}

/**
 * The two feed rails, from one query.
 *
 * "Moving fast" is votes-per-hour since creation rather than raw totals —
 * otherwise it degenerates into the same list as "Top performing" and the
 * section is decoration. New polls with real traction surface; old polls that
 * accumulated votes slowly do not.
 */
export async function getFeed(userId: string | undefined) {
  const supabase = await createClient();

  const { data: polls } = await supabase
    .from("polls")
    .select(POLL_SELECT)
    .eq("status", "live")
    .eq("is_private", false)
    .order("created_at", { ascending: false })
    .limit(40);

  const rows = ((polls ?? []) as unknown as RawPoll[]).map(normalise);
  if (rows.length === 0) return { top: [], moving: [] };

  const ids = rows.map((p) => p.id);

  const [{ data: options }, { data: myVotes }] = await Promise.all([
    supabase
      .from("options")
      .select("id, poll_id, label, vote_count, rank_snapshot, created_at")
      .in("poll_id", ids)
      .eq("hidden", false)
      .is("merged_into", null),
    userId
      ? supabase.from("votes").select("poll_id").eq("user_id", userId).in("poll_id", ids)
      : Promise.resolve({ data: [] as { poll_id: string }[] }),
  ]);

  const votedOn = new Set((myVotes ?? []).map((v: { poll_id: string }) => v.poll_id));
  const now = Date.now();
  const enriched = buildFeedPolls(rows, (options ?? []) as RankInput[], votedOn, now);

  const velocity = (p: FeedPoll) => {
    const hours = Math.max(1, (now - new Date(p.created_at).getTime()) / 3_600_000);
    return p.vote_count / hours;
  };

  return {
    top: [...enriched].sort((a, b) => b.vote_count - a.vote_count).slice(0, 10),
    moving: [...enriched]
      .filter((p) => p.vote_count > 0)
      .sort((a, b) => velocity(b) - velocity(a))
      .slice(0, 10),
  };
}
