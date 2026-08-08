import AppShell from "@/components/shell/AppShell";
import { EmptyState } from "@/components/ui/States";
import { Emoji } from "@/components/ui/Emoji";
import { createClient, getUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ago, n } from "@/lib/format";

export const metadata = { title: "Activity · MaxPoll" };
export const dynamic = "force-dynamic";

type Row = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  read: boolean;
  created_at: string;
};

/**
 * doc 03 §H. There is no web push on iOS, so this screen *is* retention.
 * `same_as_you` sorts first because it converts best.
 */
export default async function ActivityPage() {
  const user = await getUser();
  if (!user) redirect("/");

  const supabase = await createClient();
  const { data } = await supabase
    .from("activity")
    .select("id, type, payload, read, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const rows = (data ?? []) as Row[];

  /**
   * Names and counts for every `same_as_you` row in one call.
   *
   * The row itself stores no count — it would go stale the moment someone else
   * voted, and keeping it fresh would mean writing to every co-voter's row on
   * every vote. Counted here instead, where the page is already querying.
   *
   * `same_as_you_names()` returns **at most two** names and only for a poll the
   * caller actually voted in. The cap is inside the function: there is no limit
   * or offset parameter, so the rest cannot be paginated out of it. 03 §H — two
   * real names prove the list isn't a tease; the rest stay behind the ₹9.
   */
  const samePollIds = rows
    .filter((r) => r.type === "same_as_you")
    .map((r) => String(r.payload?.poll_id ?? ""))
    .filter(Boolean);

  const sameInfo = new Map<string, { total: number; names: string[] }>();
  if (samePollIds.length) {
    const { data: info } = await supabase.rpc("same_as_you_names", { p_polls: samePollIds });
    for (const i of (info ?? []) as { poll_id: string; total: number; names: string[] }[]) {
      sameInfo.set(i.poll_id, { total: i.total ?? 0, names: i.names ?? [] });
    }
  }

  // A row written when you were the only person on that option has nothing to
  // say yet. It starts saying it the moment someone agrees with you.
  const visible = rows.filter(
    (r) =>
      r.type !== "same_as_you" ||
      (sameInfo.get(String(r.payload?.poll_id ?? ""))?.total ?? 0) > 0
  );

  // Marked read on view. Done after the read so this render still shows which
  // rows were new; the badge clears on the next navigation.
  if (rows.some((r) => !r.read)) {
    await supabase.from("activity").update({ read: true }).eq("user_id", user.id).eq("read", false);
  }

  const sorted = [...visible].sort((a, b) => {
    const rank = (t: string) => (t === "same_as_you" ? 0 : 1);
    return rank(a.type) - rank(b.type);
  });

  if (sorted.length === 0) {
    return (
      <AppShell>
        <EmptyState
          icon="🔔"
          message="Nothing yet. Vote on a poll and you'll see who agreed with you."
          action={
            <Link className="btn pri" href="/">
              Find a poll
            </Link>
          }
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="feed">
        <h1 className="t-title">Activity</h1>
      </div>
      <div className="feed acts">
        {sorted.map((r) => (
          <ActivityRow
            key={r.id}
            row={r}
            same={sameInfo.get(String(r.payload?.poll_id ?? ""))}
          />
        ))}
      </div>
    </AppShell>
  );
}

function ActivityRow({
  row,
  same,
}: {
  row: Row;
  same?: { total: number; names: string[] };
}) {
  const p = row.payload ?? {};
  const when = ago(new Date(row.created_at).getTime());

  if (row.type === "same_as_you") {
    const count = same?.total ?? 0;
    const names = same?.names ?? [];
    const slug = String(p.poll_slug ?? "");
    const hidden = Math.max(0, count - names.length);

    return (
      <div className="act same">
        <span className="ic">
          <Emoji char="👥" />
        </span>
        <div className="abody">
          <p>
            <b>
              <span className="num">{n(count)}</span>{" "}
              {count === 1 ? "person" : "people"}
            </b>{" "}
            voted exactly like you on <b>{String(p.poll_title ?? "a poll")}</b>
          </p>
          {/* 03 §H: two real names, the rest blurred. The blurred chips hold a
              neutral placeholder, never an invented name — the server sent two
              names and nothing else, so there is nothing here to un-blur. */}
          <div className="namechips">
            {names.map((name) => (
              <span className="chipn" key={name}>
                {name}
              </span>
            ))}
            {hidden > 0 && (
              <>
                <span className="chipn locked" aria-hidden="true">
                  ●●●●●●
                </span>
                <span className="chipn">+{n(hidden)}</span>
              </>
            )}
          </div>
          {hidden > 0 && (
            <a className="btn sm accent" href={`/p/${slug}/unlock`}>
              Unlock names · ₹<span className="num">9</span>
            </a>
          )}
          <p className="atime">{when}</p>
        </div>
      </div>
    );
  }

  const copy: Record<string, string> = {
    option_climbed: `${String(p.label ?? "An option")} climbed to #${String(p.rank ?? "?")}`,
    // 03 §H wants the *result*, not just the fact it ended — the payload carries
    // the winner, resolved with the same ordering the board ranks by.
    poll_closed: p.winner
      ? `${String(p.poll_title ?? "A poll")} closed · ${String(p.winner)} won`
      : `${String(p.poll_title ?? "A poll")} closed`,
    // `new_follower` is gone with the follows table. Old rows may still exist in
    // someone's feed until the drop migration removes them, so the fallback
    // below renders them harmlessly rather than as "Something happened".
    badge_earned: `You earned a badge`,
    chat_hot: `People are chatting on a poll you voted in`,
  };

  const icons: Record<string, string> = {
    option_climbed: "📈",
    poll_closed: "🏁",
    badge_earned: "🏆",
    chat_hot: "💬",
  };

  const href = p.poll_slug ? `/p/${String(p.poll_slug)}` : undefined;
  const inner = (
    <>
      <span className="ic">
        <Emoji char={icons[row.type] ?? "🔔"} />
      </span>
      <div className="abody">
        <p>{copy[row.type] ?? "Something happened"}</p>
        <p className="atime">{when}</p>
      </div>
    </>
  );

  return href ? (
    <a className="act" href={href}>
      {inner}
    </a>
  ) : (
    <div className="act">{inner}</div>
  );
}
