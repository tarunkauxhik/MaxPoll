import { ImageResponse } from "next/og";
import { createAnonClient } from "@/lib/supabase/anon";
import { rankOptions } from "@/lib/rank";
import { shortLeft } from "@/lib/format";

/**
 * WhatsApp preview — doc 04 §5.16. **The only place a gradient is permitted.**
 *
 * ⚠️ DECISIONS A2: excluded from the proxy matcher and built on the anonymous
 * client, so the response carries no `Set-Cookie` and stays CDN-cacheable.
 *
 * The URL is versioned by `og_version` at the call site, because WhatsApp caches
 * previews hard and a stale one makes a live poll look dead.
 */
export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = createAnonClient();

  const { data: poll } = await supabase
    .from("polls")
    .select("id, title, vote_count, expires_at, space:spaces(name)")
    .eq("slug", slug)
    .maybeSingle();

  if (!poll) return new Response("Not found", { status: 404 });

  const { data: options } = await supabase
    .from("options")
    .select("id, label, vote_count, rank_snapshot, created_at")
    .eq("poll_id", poll.id)
    .eq("hidden", false)
    .is("merged_into", null);

  const leader = rankOptions(options ?? [], poll.vote_count ?? 0)[0];
  const space = Array.isArray(poll.space) ? poll.space[0] : poll.space;
  const left = shortLeft(poll.expires_at ? new Date(poll.expires_at).getTime() : null);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg, #111114, #2A2145 60%, #6B4EFF)",
          color: "#fff",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: "rgba(255,255,255,.6)",
          }}
        >
          {space?.name ?? "MaxPoll"}
        </div>

        <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.1, letterSpacing: -2 }}>
          {poll.title}
        </div>

        <div style={{ display: "flex", fontSize: 28, color: "rgba(255,255,255,.85)" }}>
          {leader ? (
            <span style={{ display: "flex" }}>
              🥇&nbsp;
              <span style={{ color: "#F5B324", fontWeight: 700 }}>{leader.label}</span>
              &nbsp;leading ·&nbsp;
              <span style={{ color: "#F5B324", fontWeight: 700 }}>{poll.vote_count}</span>
              &nbsp;votes · {left}
            </span>
          ) : (
            <span>Be the first to vote</span>
          )}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "public, max-age=0",
        "CDN-Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    }
  );
}
