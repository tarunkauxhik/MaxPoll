import { createAnonClient } from "@/lib/supabase/anon";
import { NextResponse } from "next/server";

/**
 * Poll chat, polled every 3s.
 *
 * ⚠️ DECISIONS A2 — like the board, this route is edge-cached and must never
 * touch a cookie. `proxy.ts` excludes it from the matcher; this uses the
 * anonymous client. Both halves are required.
 *
 * `?since=` is a cursor on the bigserial id, so a client asks only for what it
 * hasn't seen. Cached 2s rather than the board's 4s: chat feels dead at 4s, and
 * the payload is small.
 */
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const since = new URL(request.url).searchParams.get("since");

  const supabase = createAnonClient();
  let q = supabase
    .from("messages")
    .select("id, body, anon_handle, user_id, created_at")
    .eq("poll_id", id)
    .eq("hidden", false)
    .order("id", { ascending: false })
    .limit(50);

  if (since && /^\d+$/.test(since)) q = q.gt("id", since);

  const { data } = await q;

  // Ascending for rendering; the query descends so `limit` takes the newest.
  const messages = (data ?? []).slice().reverse();

  return NextResponse.json(
    { messages },
    {
      headers: {
        "Cache-Control": "public, max-age=0",
        "CDN-Cache-Control": "public, s-maxage=2, stale-while-revalidate=8",
      },
    }
  );
}
