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
  const [{ data }, { data: me }] = await Promise.all([
    supabase
      .from("activity")
      .select("id, type, payload, read, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    // Only for routing `badge_earned` at your own profile — badges are shown
    // there and nowhere else.
    supabase.from("profiles").select("handle").eq("id", user.id).maybeSingle(),
  ]);

  const rows = (data ?? []) as Row[];
  const myHandle = (me as { handle: string } | null)?.handle ?? null;

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
            myHandle={myHandle}
          />
        ))}
      </div>
    </AppShell>
  );
}

function ActivityRow({
  row,
  same,
  myHandle,
}: {
  row: Row;
  same?: { total: number; names: string[] };
  /** For `badge_earned`, whose destination is your own profile. */
  myHandle: string | null;
}) {
  const p = row.payload ?? {};
  const when = ago(new Date(row.created_at).getTime());

  if (row.type === "same_as_you") {
    const count = same?.total ?? 0;
    const names = same?.names ?? [];
    const slug = String(p.poll_slug ?? "");
    const hidden = Math.max(0, count - names.length);

    /**
     * The row is a link to the poll, like every other row. It used to be an
     * inert `<div>` — the one notification type that converts best was the one
     * you could not tap.
     *
     * The unlock CTA inside it is a *second*, different destination, so it stays
     * its own `<a>`. Nesting one anchor inside another is invalid HTML and the
     * browser un-nests it, so the row is a `<div>` wrapper holding two siblings:
     * a link covering the body, and the CTA beside it.
     */
    return (
      <div className="act same">
        <a className="act-hit" href={`/p/${slug}`} aria-label={`Open ${String(p.poll_title ?? "the poll")}`} />
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

  /**
   * Every row goes somewhere. A notification you cannot tap is a dead end, and
   * three of these types used to render as inert `<div>`s whenever the payload
   * happened to carry no `poll_slug`.
   *
   * The poll is the destination when there is one. `badge_earned` belongs on
   * your own profile, where badges are actually shown. Anything unrecognised —
   * including rows written by a version of the app that has since changed —
   * falls back to the feed rather than to nothing.
   */
  const slug = p.poll_slug ? String(p.poll_slug) : null;
  const chatTypes = row.type === "chat_hot";
  const href = slug
    ? chatTypes
      ? `/p/${slug}/chat`
      : `/p/${slug}`
    : row.type === "badge_earned" && myHandle
      ? `/u/${myHandle}`
      : "/";

  return (
    <a className="act" href={href}>
      <span className="ic">
        <Emoji char={icons[row.type] ?? "🔔"} />
      </span>
      <div className="abody">
        <p>{copy[row.type] ?? "Something happened"}</p>
        <p className="atime">{when}</p>
      </div>
      <span className="act-chev" aria-hidden="true">
        ›
      </span>
    </a>
  );
}
