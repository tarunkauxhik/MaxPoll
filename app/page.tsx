import { createClient, getProfile } from "@/lib/supabase/server";
import { createAnonClient } from "@/lib/supabase/anon";
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

  if (!user) return <Landing stats={await realStats()} />;

  const profile = await getProfile();
  // Signed in but never finished onboarding — the callback normally catches this;
  // this covers someone who abandoned the form and came back later.
  if (!profile) return <Landing stats={await realStats()} />;

  return <Feed />;
}

/**
 * Real aggregates only — 01-product.md. Returns null below a floor rather than
 * publishing a number that makes the product look dead, because the alternative
 * (inventing one) is the fastest way to lose trust in a public voting product.
 */
async function realStats() {
  const supabase = createAnonClient();

  const [polls, spaces, voteAgg] = await Promise.all([
    supabase.from("polls").select("id", { count: "exact", head: true }).eq("status", "live"),
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
