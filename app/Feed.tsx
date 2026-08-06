import AppShell from "@/components/shell/AppShell";
import { PollCard } from "@/components/poll/PollCard";
import { EmptyState } from "@/components/ui/States";
import { getFeed } from "@/lib/poll-queries";
import { getUser } from "@/lib/supabase/server";
import { ActivityBell } from "@/components/shell/ActivityBell";
import { Emoji } from "@/components/ui/Emoji";

/**
 * Home, signed in — doc 04 §6. Raw totals, then velocity, and — above both when
 * it has anything in it — the polls closing within six hours.
 *
 * That order is deliberate: a poll whose result you can still change outranks
 * one that is merely popular, and it is the only rail on this page with a
 * deadline attached. All three come from the same query.
 */
export async function Feed() {
  const user = await getUser();
  const { top, moving, endingSoon } = await getFeed(user?.id);

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
      {endingSoon.length > 0 && (
        <>
          <div className="feed">
            <h2 className="t-label hot">
              <Emoji char="⏳" /> Closing soon
            </h2>
          </div>
          <div className="feed">
            {endingSoon.map((p) => (
              <PollCard key={`e-${p.id}`} poll={p} />
            ))}
          </div>
        </>
      )}

      <div className="feed">
        <h2 className="t-label">
          <Emoji char="🔥" /> Top performing today
        </h2>
      </div>
      <div className="feed">
        {top.map((p) => (
          <PollCard key={p.id} poll={p} />
        ))}
      </div>

      {moving.length > 0 && (
        <>
          <div className="feed">
            <h2 className="t-label">
              <Emoji char="📈" /> Moving fast
            </h2>
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
