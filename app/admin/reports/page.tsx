import AppShell from "@/components/shell/AppShell";
import { ModerationQueue } from "../AdminForms";
import { requireAdmin, loadReports } from "../data";

export const metadata = { title: "Reported · Admin" };
export const dynamic = "force-dynamic";

export default async function AdminReportsPage() {
  const supabase = await requireAdmin();
  const rows = await loadReports(supabase);

  return (
    <AppShell>
      <div className="adminwrap">
        <a className="backlink" href="/admin">
          ← Admin
        </a>
        <h1 className="t-title">
          Reported{" "}
          {rows.length > 0 && <span className="num">({rows.length})</span>}
        </h1>
        <p className="t-sec adminlede">
          Content hides itself once <span className="num">3</span> different people
          report it. Anything below that is waiting on you.
        </p>

        <ModerationQueue rows={rows} />
      </div>
    </AppShell>
  );
}
