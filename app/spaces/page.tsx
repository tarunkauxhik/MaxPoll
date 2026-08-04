import AppShell from "@/components/shell/AppShell";
import { SpaceCard } from "@/components/SpaceCard";
import { EmptyState } from "@/components/ui/States";
import { createClient, getUser } from "@/lib/supabase/server";

export const metadata = { title: "Spaces · MaxPoll" };

const UNLOCK = 20;

export default async function SpacesPage() {
  const user = await getUser();
  const supabase = await createClient();

  const [{ data: all }, { data: mine }] = await Promise.all([
    supabase
      .from("spaces")
      .select("id, slug, name, description, member_count")
      .order("member_count", { ascending: false })
      .limit(60),
    user
      ? supabase.from("space_members").select("space_id").eq("user_id", user.id)
      : Promise.resolve({ data: [] as { space_id: string }[] }),
  ]);

  const joined = new Set((mine ?? []).map((m: { space_id: string }) => m.space_id));
  const spaces = all ?? [];

  const yours = spaces.filter((s) => joined.has(s.id));
  const growing = spaces.filter((s) => !joined.has(s.id) && s.member_count < UNLOCK);
  const discover = spaces.filter((s) => !joined.has(s.id) && s.member_count >= UNLOCK);

  if (spaces.length === 0) {
    return (
      <AppShell>
        <EmptyState
          icon="🏫"
          message="No Spaces yet. Create the first one for your college."
          action={
            <a className="btn pri" href="/spaces/new">
              Create a Space
            </a>
          }
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="feed">
        <h1 className="t-title">Spaces</h1>
      </div>

      {yours.length > 0 && <Section title="You're in" spaces={yours} />}
      {growing.length > 0 && <Section title="Growing" spaces={growing} showProgress />}
      {discover.length > 0 && <Section title="Discover" spaces={discover} />}

      <div className="feed">
        <a className="btn sec fullw" href="/spaces/new">
          + Create a Space
        </a>
      </div>
    </AppShell>
  );
}

function Section({
  title,
  spaces,
  showProgress,
}: {
  title: string;
  spaces: { id: string; slug: string; name: string; member_count: number }[];
  showProgress?: boolean;
}) {
  return (
    <>
      <div className="feed">
        <h2 className="t-label">{title}</h2>
      </div>
      <div className="feed">
        {spaces.map((s) => (
          <SpaceCard key={s.id} space={s} showProgress={showProgress} />
        ))}
      </div>
    </>
  );
}
