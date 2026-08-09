import AppShell from "@/components/shell/AppShell";
import { GrantForm } from "../AdminForms";
import { requireAdmin } from "../data";

export const metadata = { title: "Grant access · Admin" };
export const dynamic = "force-dynamic";

export default async function AdminGrantPage() {
  await requireAdmin();

  return (
    <AppShell>
      <div className="adminwrap">
        <a className="backlink" href="/admin">
          ← Admin
        </a>
        <h1 className="t-title">Grant access by hand</h1>
        <p className="t-sec adminlede">
          No payment taken. Recorded as a <b>comp</b> in the ledger, so the books never
          show money that did not move.
        </p>

        <GrantForm />
      </div>
    </AppShell>
  );
}
