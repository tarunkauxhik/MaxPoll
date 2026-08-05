import AppShell from "@/components/shell/AppShell";
import { getUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { NewSpaceForm } from "./NewSpaceForm";

export const metadata = { title: "Create a Space · MaxPoll" };

export default async function NewSpacePage({
  searchParams,
}: {
  // Next 16: searchParams is a Promise.
  searchParams: Promise<{ next?: string }>;
}) {
  const [user, { next }] = await Promise.all([getUser(), searchParams]);
  if (!user) redirect("/");

  return (
    <AppShell>
      <div className="createwrap">
        <h1 className="t-title">New Space</h1>
        <p className="t-sec">A college, a company, a group chat. Polls live inside one.</p>
        <NewSpaceForm next={next} />
      </div>
    </AppShell>
  );
}
