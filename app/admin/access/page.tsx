import AppShell from "@/components/shell/AppShell";
import { GrantedList } from "../AdminForms";
import { requireAdmin, loadGranted } from "../data";

export const metadata = { title: "Who has access · Admin" };
export const dynamic = "force-dynamic";

export default async function AdminAccessPage() {
  const supabase = await requireAdmin();
  const rows = await loadGranted(supabase);

  return (
    <AppShell>
      <div className="adminwrap">
        <a className="backlink" href="/admin">
          ← Admin
        </a>
        <h1 className="t-title">
          Who has access{" "}
          {rows.length > 0 && <span className="num">({rows.length})</span>}
        </h1>
        <p className="t-sec adminlede">
          Everyone who can see voter names, and how they got in.
        </p>

        <GrantedList rows={rows} />
      </div>
    </AppShell>
  );
}
