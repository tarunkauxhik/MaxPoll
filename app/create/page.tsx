import AppShell from "@/components/shell/AppShell";
import { createClient, getUser } from "@/lib/supabase/server";
import { CreateForm } from "./CreateForm";
import { pollsLeftThisWeek } from "./actions";
import { EmptyState } from "@/components/ui/States";
import { SignInButton } from "../SignInButton";
import { activePass } from "@/lib/poll-queries";
import { paymentMode } from "@/lib/payments";

export const metadata = { title: "Create a poll · MaxPoll" };

export default async function CreatePage() {
  const user = await getUser();
  if (!user) {
    return (
      <AppShell>
        <EmptyState
          icon="✍️"
          message="Sign in to create a poll. It takes 30 seconds."
          action={<SignInButton next="/create" />}
        />
      </AppShell>
    );
  }

  const supabase = await createClient();
  const [{ data: memberships }, { count: spacesAnywhere }, left, { pass }] = await Promise.all([
    supabase.from("space_members").select("spaces(id, name)").eq("user_id", user.id),
    supabase.from("spaces").select("id", { count: "exact", head: true }),
    pollsLeftThisWeek(user.id),
    activePass(user.id),
  ]);

  const spaces = (memberships ?? []).flatMap(
    (m: { spaces: { id: string; name: string } | { id: string; name: string }[] | null }) =>
      m.spaces ? (Array.isArray(m.spaces) ? m.spaces : [m.spaces]) : []
  );

  /**
   * Two different situations, and sending both to `/spaces` made one of them a
   * dead end: on a young site there is nothing there to browse, so "Browse
   * Spaces" landed on another empty state pointing at a third screen.
   *
   * `?next=/create` brings them back here once the Space exists — `create_space`
   * joins the creator in the same transaction, so it's already in the picker.
   */
  if (spaces.length === 0) {
    const none = (spacesAnywhere ?? 0) === 0;
    return (
      <AppShell>
        <EmptyState
          icon="🏫"
          message={
            none
              ? "No Spaces yet — polls live inside one. Make the first."
              : "Join a Space first — polls live inside one."
          }
          action={
            <a className="btn pri" href={none ? "/spaces/new?next=/create" : "/spaces"}>
              {none ? "Create a Space" : "Browse Spaces"}
            </a>
          }
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="createwrap">
        <h1 className="t-title">New poll</h1>
        <CreateForm spaces={spaces} left={left} hasPass={!!pass} mode={paymentMode()} />
      </div>
    </AppShell>
  );
}
