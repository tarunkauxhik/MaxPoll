import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAnonClient } from "@/lib/supabase/anon";
import { rankOptions, type BoardOption, type RankInput } from "@/lib/rank";
import { keyFilter } from "@/lib/short-code";
import { endingSoon } from "@/lib/format";

export type { BoardOption, RankInput };

export type PollRow = {
  id: string;
  slug: string;
  /** Short share code. `/p/<code>` and `/p/<slug>` both resolve — see byKey(). */
  code: string;
  title: string;
  status: "live" | "closed" | "removed";
  subject_type: "person" | "thing";
  vote_count: number;
  option_count: number;
  message_count: number;
  options_locked: boolean;
  expires_at: string | null;
  created_at: string;
  created_by: string | null;
  is_private: boolean;
  og_version: number;
  space: {
    id: string;
    slug: string;
    code: string;
    name: string;
    member_count: number;
  } | null;
};

const SPACE_SELECT = "space:spaces(id, slug, code, name, member_count)";

/**
 * Exported because a profile and a Space page were both spelling this out by
 * hand, and a column added to `PollRow` then compiled everywhere and returned
 * `undefined` at runtime on the two pages that had their own copy.
 */
export const POLL_SELECT = `id, slug, code, title, status, subject_type, vote_count, option_count, message_count, options_locked,
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

/**
 * Board options for a poll. Anonymous client — never touches cookies (A2).
 *
 * Memoised per request: `generateMetadata` needs the leader for the share
 * preview and the page needs the whole board, so this ran twice on every poll
 * view — twice the query *and* twice the `snapshot_ranks` call behind it.
 */
export const getBoard = cache(async (pollId: string, totalVotes: number) => {
  const supabase = createAnonClient();
  const { data } = await supabase
    .from("options")
    .select("id, label, vote_count, rank_snapshot, created_at")
    .eq("poll_id", pollId)
    .eq("hidden", false)
    .is("merged_into", null);

  return rankOptions(data ?? [], totalVotes);
});

/**
 * By readable slug **or** short code — `/p/best-teacher-x8f2q` and `/p/k7m2xqp`
 * are the same poll. One query, no redirect: this is the hottest path in the
 * product and a 301 hop on it would be paid by every share.
 *
 * Memoised for the same reason as getBoard: metadata and page both need it.
 */
export const getPollBySlug = cache(async (slug: string) => {
  const filter = keyFilter(slug);
  if (!filter) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("polls")
    .select(POLL_SELECT)
    .or(filter)
    .maybeSingle();
  return data ? normalise(data as unknown as RawPoll) : null;
});

export type SpaceRow = {
  id: string;
  slug: string;
  code: string;
  name: string;
  description: string | null;
  member_count: number;
  is_verified: boolean;
  /** Who may delete it — the Space page renders its control off this. */
  created_by: string | null;
};

/**
 * Same two-key resolution as getPollBySlug. Memoised because `generateMetadata`
 * and the page body both need the Space, and they were each fetching it.
 */
export const getSpaceByKey = cache(async (key: string) => {
  const filter = keyFilter(key);
  if (!filter) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("spaces")
    .select("id, slug, code, name, description, member_count, is_verified, created_by")
    .or(filter)
    .maybeSingle();
  return (data as SpaceRow | null) ?? null;
});

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

/**
 * Everything the user currently has access to, for the Subscription screen.
 *
 * `activePass` answers "is there a pass?" and that is all the paywall needs.
 * This answers "what have I actually bought?", which is a different question and
 * the one Settings is opened to ask — a per-poll unlock is a purchase too, and
 * the screen used to show no trace of one.
 *
 * Joined to `polls` so each unlock can name and link its poll. A deleted poll
 * cascades its entitlement away, so there is no dangling-row case to handle.
 */
export async function myAccess(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("entitlements")
    .select("kind, poll_id, expires_at, source, created_at, poll:polls(slug, title)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  const now = Date.now();
  const live = (e: { expires_at: string | null }) =>
    e.expires_at === null || new Date(e.expires_at).getTime() > now;

  const rows = (data ?? []) as unknown as {
    kind: string;
    poll_id: string | null;
    expires_at: string | null;
    source: string;
    created_at: string;
    poll: { slug: string; title: string } | { slug: string; title: string }[] | null;
  }[];

  return {
    pass: rows.find((e) => e.kind === "sub_monthly" && live(e)) ?? null,
    unlocks: rows
      .filter((e) => e.kind === "poll_unlock" && live(e))
      .map((e) => ({
        ...e,
        poll: Array.isArray(e.poll) ? (e.poll[0] ?? null) : e.poll,
      })),
  };
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
  /** Inside the 6h window where a share can still change the result. */
  endingSoon: boolean;
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
    endingSoon: endingSoon(p.expires_at ? new Date(p.expires_at).getTime() : null, now),
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

  // Expired-but-not-yet-closed polls would otherwise eat the 40-row budget and
  // appear in both rails — "Top performing today" is not a place for a poll that
  // ended yesterday. `status` catches manually closed ones; `expires_at` catches
  // the ones the daily cron has not reached yet.
  const { data: polls } = await supabase
    .from("polls")
    .select(POLL_SELECT)
    .eq("status", "live")
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .eq("is_private", false)
    .order("created_at", { ascending: false })
    .limit(40);

  const rows = ((polls ?? []) as unknown as RawPoll[]).map(normalise);
  if (rows.length === 0) return { top: [], moving: [], endingSoon: [] };

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
    /**
     * Closing within 6h, soonest first. The only rail with a deadline attached,
     * so it goes at the top of the feed when it has anything in it — a poll you
     * can still change the result of outranks one that is merely popular.
     *
     * Free: same rows, same query, sorted a third way. `expires_at` is non-null
     * for every member by construction, so the `!` is safe.
     */
    endingSoon: enriched
      .filter((p) => p.endingSoon)
      .sort(
        (a, b) =>
          new Date(a.expires_at!).getTime() - new Date(b.expires_at!).getTime()
      )
      .slice(0, 6),
  };
}
