import AppShell from "@/components/shell/AppShell";
import { createClient, getUser } from "@/lib/supabase/server";
import { CreateForm } from "./CreateForm";
import { pollsLeftThisWeek } from "./actions";
import { EmptyState } from "@/components/ui/States";
import { SignInButton } from "../SignInButton";

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
  const [{ data: memberships }, left] = await Promise.all([
    supabase.from("space_members").select("spaces(id, name)").eq("user_id", user.id),
    pollsLeftThisWeek(user.id),
  ]);

  const spaces = (memberships ?? []).flatMap(
    (m: { spaces: { id: string; name: string } | { id: string; name: string }[] | null }) =>
      m.spaces ? (Array.isArray(m.spaces) ? m.spaces : [m.spaces]) : []
  );

  if (spaces.length === 0) {
    return (
      <AppShell>
        <EmptyState
          icon="🏫"
          message="Join a Space first — polls live inside one."
          action={
            <a className="btn pri" href="/spaces">
              Browse Spaces
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
        <CreateForm spaces={spaces} left={left} />
      </div>
    </AppShell>
  );
}
