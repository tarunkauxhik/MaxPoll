import AppShell from "@/components/shell/AppShell";
import { PollCard } from "@/components/poll/PollCard";
import { EmptyState } from "@/components/ui/States";
import { getFeed } from "@/lib/poll-queries";
import { getUser } from "@/lib/supabase/server";
import { ActivityBell } from "@/components/shell/ActivityBell";

/** Home, signed in — doc 04 §6. Two rails: raw totals, then velocity. */
export async function Feed() {
  const user = await getUser();
  const { top, moving } = await getFeed(user?.id);

  if (top.length === 0) {
    return (
      <AppShell topBarRight={<ActivityBell />}>
        <EmptyState
          icon="🗳️"
          message="No polls yet. Be the first — it takes 30 seconds."
          action={
            <a className="btn pri" href="/create">
              Create a poll
            </a>
          }
        />
      </AppShell>
    );
  }

  return (
    <AppShell topBarRight={<ActivityBell />}>
      <div className="feed">
        <h2 className="t-label">🔥 Top performing today</h2>
      </div>
      <div className="feed">
        {top.map((p) => (
          <PollCard key={p.id} poll={p} />
        ))}
      </div>

      {moving.length > 0 && (
        <>
          <div className="feed">
            <h2 className="t-label">📈 Moving fast</h2>
          </div>
          <div className="feed">
            {moving.map((p) => (
              <PollCard key={`m-${p.id}`} poll={p} />
            ))}
          </div>
        </>
      )}
    </AppShell>
  );
}
