import AppShell from "@/components/shell/AppShell";
import { EmptyState } from "@/components/ui/States";
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

  // Marked read on view. Done after the read so this render still shows which
  // rows were new; the badge clears on the next navigation.
  if (rows.some((r) => !r.read)) {
    await supabase.from("activity").update({ read: true }).eq("user_id", user.id).eq("read", false);
  }

  const sorted = [...rows].sort((a, b) => {
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
          <ActivityRow key={r.id} row={r} />
        ))}
      </div>
    </AppShell>
  );
}

function ActivityRow({ row }: { row: Row }) {
  const p = row.payload ?? {};
  const when = ago(new Date(row.created_at).getTime());

  if (row.type === "same_as_you") {
    const count = Number(p.count ?? 0);
    const slug = String(p.poll_slug ?? "");
    return (
      <div className="act same">
        <span className="ic" aria-hidden="true">
          👥
        </span>
        <div className="abody">
          <p>
            <b>
              <span className="num">{n(count)}</span> people
            </b>{" "}
            voted exactly like you on <b>{String(p.poll_title ?? "a poll")}</b>
          </p>
          {/* Two real names would show here for an entitled user. Unentitled,
              the server sends placeholders only — RLS refuses the real ones, so
              there is nothing in the payload to un-blur. */}
          <div className="namechips">
            <span className="chipn locked">Aarav S.</span>
            <span className="chipn locked">Priya M.</span>
            <span className="chipn locked">+{Math.max(0, count - 2)}</span>
          </div>
          <a className="btn sm vio" href={`/p/${slug}/unlock`}>
            Unlock names · ₹<span className="num">9</span>
          </a>
          <p className="atime">{when}</p>
        </div>
      </div>
    );
  }

  const copy: Record<string, string> = {
    option_climbed: `${String(p.label ?? "An option")} climbed to #${String(p.rank ?? "?")}`,
    poll_closed: `${String(p.poll_title ?? "A poll")} closed`,
    new_follower: `Someone started following you`,
    badge_earned: `You earned a badge`,
    chat_hot: `People are chatting on a poll you voted in`,
  };

  const icons: Record<string, string> = {
    option_climbed: "📈",
    poll_closed: "🏁",
    new_follower: "➕",
    badge_earned: "🏆",
    chat_hot: "💬",
  };

  const href = p.poll_slug ? `/p/${String(p.poll_slug)}` : undefined;
  const inner = (
    <>
      <span className="ic" aria-hidden="true">
        {icons[row.type] ?? "🔔"}
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
