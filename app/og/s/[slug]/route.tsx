import { ImageResponse } from "next/og";
import { createAnonClient } from "@/lib/supabase/anon";
import { n, plural, monogram } from "@/lib/format";
import { keyFilter } from "@/lib/short-code";
import { SPACE_UNLOCK_MEMBERS } from "@/lib/space";
import { C, OG, HEADERS, shell, row, col, Eyebrow, Hook, clip } from "../../shared";

/**
 * WhatsApp preview for a **Space**.
 *
 * A Space link is what gets pasted into a college or office group first — it was
 * the link that went out on launch day — and it had no preview image at all.
 * The card has to answer one question in the half-second before a thumb decides:
 * *what are people in here arguing about?* So it shows live poll titles, not a
 * description.
 *
 * ⚠️ Same A2 rules as the poll preview: anonymous client, excluded from the
 * proxy matcher, no `Set-Cookie`.
 */
export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const filter = keyFilter(slug);
  if (!filter) return new Response("Not found", { status: 404 });

  const supabase = createAnonClient();

  const { data: space } = await supabase
    .from("spaces")
    .select("id, name, member_count")
    .or(filter)
    .maybeSingle();

  if (!space) return new Response("Not found", { status: 404 });

  // Fetched wide, shown narrow. The card lists three polls but the hook claims a
  // total, and summing only the three it shows would understate a busy Space —
  // a number on a share card has to be the number it says it is.
  const { data: polls } = await supabase
    .from("polls")
    .select("id, title, vote_count")
    .eq("space_id", space.id)
    .eq("status", "live")
    .eq("is_private", false)
    .order("vote_count", { ascending: false })
    .limit(50);

  const all = polls ?? [];
  const live = all.slice(0, 3);
  const members = space.member_count ?? 0;
  const total = all.reduce((s, p) => s + (p.vote_count ?? 0), 0);

  // Under the unlock threshold the honest hook is the one that recruits: this
  // Space needs people before it shows anyone results. Above it, the volume is
  // the proof.
  const short = SPACE_UNLOCK_MEMBERS - members;
  const hook =
    members < SPACE_UNLOCK_MEMBERS
      ? `${plural(short, "person", "people")} away from live results`
      : total > 0
        ? `${plural(total, "vote")} cast · tap to settle it`
        : "Start the first argument";

  return new ImageResponse(
    (
      <div style={shell}>
        <div style={{ ...row, justifyContent: "space-between" }}>
          <Eyebrow text="Space" live={live.length > 0} />
          <div style={{ ...row, gap: 12, fontSize: 26, color: C.dim }}>
            <div style={{ display: "flex", fontWeight: 700, color: "#fff" }}>
              {n(members)}
            </div>
            <div style={{ display: "flex" }}>members</div>
          </div>
        </div>

        <div style={{ ...col, gap: 36 }}>
          <div style={{ ...row, gap: 26 }}>
            <div
              style={{
                ...row,
                justifyContent: "center",
                width: 96,
                height: 96,
                borderRadius: 28,
                backgroundColor: C.violet,
                fontSize: 38,
                fontWeight: 800,
              }}
            >
              {monogram(space.name)}
            </div>
            <div
              style={{
                display: "flex",
                flex: 1,
                fontSize: space.name.length > 22 ? 58 : 70,
                fontWeight: 800,
                lineHeight: 1.05,
                letterSpacing: -2,
              }}
            >
              {clip(space.name, 40)}
            </div>
          </div>

          {live.length > 0 && (
            <div style={{ ...col, gap: 12 }}>
              {live.map((p) => (
                <div
                  key={p.id}
                  style={{
                    ...row,
                    justifyContent: "space-between",
                    gap: 24,
                    padding: "18px 26px",
                    borderRadius: 18,
                    backgroundColor: "rgba(255,255,255,.07)",
                    border: `1px solid ${C.dimmer}`,
                  }}
                >
                  <div style={{ display: "flex", fontSize: 30, fontWeight: 600 }}>
                    {clip(p.title, 44)}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      fontSize: 26,
                      fontWeight: 700,
                      color: C.gold,
                      flexShrink: 0,
                    }}
                  >
                    {plural(p.vote_count ?? 0, "vote")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <Hook
          text={hook}
          accent={members < SPACE_UNLOCK_MEMBERS ? C.violet : C.gold}
        />
      </div>
    ),
    { ...OG, headers: HEADERS }
  );
}
