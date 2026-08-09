import AppShell from "@/components/shell/AppShell";
import { rupees } from "@/lib/payments";
import { ago } from "@/lib/format";
import { OrderRow } from "../AdminForms";
import { requireAdmin, loadOrders, clock } from "../data";

export const metadata = { title: "Payments · Admin" };
export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage() {
  const supabase = await requireAdmin();
  const [orders, now] = await Promise.all([loadOrders(supabase), clock()]);

  return (
    <AppShell>
      <div className="adminwrap">
        <a className="backlink" href="/admin">
          ← Admin
        </a>
        <h1 className="t-title">
          Payments to verify{" "}
          {orders.length > 0 && <span className="num">({orders.length})</span>}
        </h1>
        <p className="t-sec adminlede">
          Open one, check the UTR against your UPI app, then verify. Verifying grants
          access in the same transaction.
        </p>

        {orders.length === 0 ? (
          <p className="t-sec">Nothing waiting.</p>
        ) : (
          <ul className="queue">
            {orders.map((o) => (
              <li key={o.id}>
                <OrderRow
                  id={o.id}
                  ref_={o.ref}
                  /* Expected amount is on screen on purpose: a UPI intent's `am`
                     is editable and a static QR carries none, so a human
                     comparing this against the merchant app IS the amount check.
                     If it isn't visible, it doesn't happen. */
                  expected={rupees(o.amount_paise)}
                  utr={o.utr ?? ""}
                  who={o.profiles ? `@${o.profiles.handle}` : "unknown"}
                  whoName={o.profiles?.display_name ?? null}
                  what={o.kind === "pass_30d" ? "30-day pass" : (o.polls?.title ?? "poll")}
                  kind={o.kind}
                  pollSlug={o.polls?.slug ?? null}
                  contact={o.contact}
                  when={o.submitted_at ? ago(new Date(o.submitted_at).getTime(), now) : ""}
                  createdAt={o.created_at}
                  submittedAt={o.submitted_at}
                  decidedAt={o.decided_at}
                  adminNote={o.admin_note}
                  status={o.status}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
