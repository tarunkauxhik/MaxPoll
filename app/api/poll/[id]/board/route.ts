import { createAnonClient } from "@/lib/supabase/anon";
import { rankOptions } from "@/lib/rank";
import { NextResponse } from "next/server";

/**
 * The live board. Polled every 4s by every viewer, so this route is the one that
 * decides whether the free tier survives launch.
 *
 * ⚠️ RULES.md, caching: this handler must NEVER read or write a cookie. It uses the
 * anonymous client for exactly that reason, and `proxy.ts` excludes this path
 * from its matcher. Break either half and every viewer invokes a function
 * instead of hitting the CDN — silently, with no error anywhere.
 */
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  // Next 16: params is a Promise.
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createAnonClient();

  const { data: poll } = await supabase
    .from("polls")
    .select("id, vote_count, status, expires_at")
    .eq("id", id)
    .maybeSingle();

  if (!poll) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  // No joins, no voter names — Hobby's Fast Origin Transfer is ~10GB/mo and only
  // cache misses count, so this payload stays lean (A6).
  const { data: rows } = await supabase
    .from("options")
    .select("id, label, vote_count, rank_snapshot, created_at")
    .eq("poll_id", id)
    .eq("hidden", false)
    .is("merged_into", null);

  const options = rankOptions(rows ?? [], poll.vote_count ?? 0);

  // Movement snapshot — RULES.md. The 60s guard lives inside the function,
  // so a ▲2 badge persists across cache windows instead of flickering every 4s.
  // No cron: the response is cached at s-maxage=4, so this runs at most once per
  // 4s per poll no matter how many people are watching. CLAUDE.md forbids a cron
  // for ranks precisely because this already self-limits.
  //
  // It must be `security definer` — `options` is creator-writable under RLS, so
  // a direct write from this anonymous handler would silently never land and no
  // movement badge would ever appear.
  await supabase.rpc("snapshot_ranks", { p_poll: id });

  return NextResponse.json(
    { options, voteCount: poll.vote_count ?? 0, status: poll.status },
    {
      headers: {
        // Browser must not cache: every client poll has to actually reach the
        // edge, or viewers sit on stale boards. The CDN does the absorbing.
        "Cache-Control": "public, max-age=0",
        "CDN-Cache-Control": "public, s-maxage=4, stale-while-revalidate=10",
      },
    }
  );
}
