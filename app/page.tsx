import { createClient, getProfile } from "@/lib/supabase/server";
import { createAnonClient } from "@/lib/supabase/anon";
import { redirect } from "next/navigation";
import { Landing } from "./Landing";
import { Feed } from "./Feed";

/**
 * `/` is two pages. Logged out: the landing, whose hero *is* a leaderboard.
 * Logged in: the feed.
 */
export default async function Page() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const [stats, live] = await Promise.all([realStats(), livePolls()]);
    return <Landing stats={stats} live={live} />;
  }

  const profile = await getProfile();
  /**
   * Signed in but never finished onboarding — the callback catches this on the
   * way in; this catches someone who abandoned the form and came back later.
   *
   * It used to render the landing, which left them looking at a "Continue with
   * Google" button while already signed in — no way forward except signing in
   * again. There is a real account in this state on production.
   */
  if (!profile) redirect("/onboarding");

  return <Feed />;
}

/**
 * Real aggregates only — 01-product.md. Returns null below a floor rather than
 * publishing a number that makes the product look dead, because the alternative
 * (inventing one) is the fastest way to lose trust in a public voting product.
 */
async function realStats() {
  const supabase = createAnonClient();

  // `status` only becomes 'closed' when the daily cron runs, so a poll that
  // expired at 15:00 would otherwise be counted as live until 06:00 UTC. The
  // headline number on this page is the one place that claim has to hold.
  const unexpired = `expires_at.is.null,expires_at.gt.${new Date().toISOString()}`;

  const [polls, spaces, voteAgg] = await Promise.all([
    supabase
      .from("polls")
      .select("id", { count: "exact", head: true })
      .eq("status", "live")
      .or(unexpired),
    supabase.from("spaces").select("id", { count: "exact", head: true }),
    // Sums the denormalised counters. NEVER count(*) on votes — CLAUDE.md.
    supabase.from("polls").select("vote_count"),
  ]);

  const votes = (voteAgg.data ?? []).reduce(
    (sum: number, p: { vote_count: number | null }) => sum + (p.vote_count ?? 0),
    0
  );

  if (votes < 50) return null;
  return { votes, polls: polls.count ?? 0, spaces: spaces.count ?? 0 };
}

/**
 * Three real, live, public polls for the landing page.
 *
 * Proof beats claims: a stranger who can read *"Greatest Indian ODI batter ·
 * 47 votes · 4h left"* before signing in knows what this is, and knows it has
 * people in it. The demo board above is unmistakably a sample and cannot do
 * that job.
 *
 * Titles and counts only — no options, and therefore no names. That keeps this
 * to one small query on the busiest anonymous route, and keeps the "vote to
 * reveal" gate intact on a page nobody has signed in to yet.
 */
async function livePolls() {
  const supabase = createAnonClient();
  const { data } = await supabase
    .from("polls")
    .select("slug, title, vote_count, expires_at, space:spaces(name)")
    .eq("status", "live")
    .eq("is_private", false)
    // A poll on zero votes is not proof of anything — it is the exact thing this
    // section exists to disprove. Better to show two than three with a dead one.
    .gt("vote_count", 0)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order("vote_count", { ascending: false })
    .limit(3);

  // PostgREST types an embedded to-one relation as an array — it cannot know the
  // FK is single-valued without generated types. Same normalisation as
  // poll-queries' `normalise()`.
  type Row = {
    slug: string;
    title: string;
    vote_count: number | null;
    expires_at: string | null;
    space: { name: string } | { name: string }[] | null;
  };

  return ((data ?? []) as unknown as Row[]).map((p) => ({
    slug: p.slug,
    title: p.title,
    votes: p.vote_count ?? 0,
    expiresAt: p.expires_at,
    space: (Array.isArray(p.space) ? p.space[0] : p.space)?.name ?? null,
  }));
}
