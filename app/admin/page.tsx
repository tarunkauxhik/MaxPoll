import { notFound } from "next/navigation";
import AppShell from "@/components/shell/AppShell";
import { getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin, rupees, paymentMode } from "@/lib/payments";
import { ago } from "@/lib/format";
import { GrantForm, OrderRow } from "./AdminForms";

export const metadata = { title: "Admin · MaxPoll" };
export const dynamic = "force-dynamic";

type QueueOrder = {
  id: string;
  ref: string;
  kind: string;
  amount_paise: number;
  utr: string | null;
  contact: string | null;
  submitted_at: string | null;
  profiles: { handle: string; display_name: string } | null;
  polls: { slug: string; title: string } | null;
};

export default async function AdminPage() {
  const user = await getUser();

  // 404, not 403 — don't confirm the route exists to someone probing for it.
  if (!isAdmin(user?.id)) notFound();

  // There is deliberately no admin RLS policy on `orders`, so this is the only
  // path that can read them (DECISIONS D3).
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("orders")
    .select(
      "id, ref, kind, amount_paise, utr, contact, submitted_at, profiles:user_id(handle, display_name), polls:poll_id(slug, title)"
    )
    .eq("status", "submitted")
    .order("submitted_at", { ascending: true });

  const orders = ((data ?? []) as unknown as (Omit<QueueOrder, "profiles" | "polls"> & {
    profiles: QueueOrder["profiles"] | QueueOrder["profiles"][];
    polls: QueueOrder["polls"] | QueueOrder["polls"][];
  })[]).map((o) => ({
    ...o,
    profiles: Array.isArray(o.profiles) ? (o.profiles[0] ?? null) : o.profiles,
    polls: Array.isArray(o.polls) ? (o.polls[0] ?? null) : o.polls,
  }));

  const live = paymentMode() === "manual_upi";

  return (
    <AppShell>
      <div className="adminwrap">
        <h1 className="t-title">Admin</h1>

        {!live && (
          <p className="notice">
            Payments are <b>off</b> — no VPA is configured, so no UPI orders can
            arrive. Grant access directly below.
          </p>
        )}

        <section>
          <h2 className="t-card">Grant access</h2>
          <p className="t-sec">No payment. Recorded as a comp in the ledger.</p>
          <GrantForm />
        </section>

        <section>
          <h2 className="t-card">
            Pending payments{" "}
            {orders.length > 0 && <span className="num">({orders.length})</span>}
          </h2>

          {orders.length === 0 ? (
            <p className="t-sec">Nothing waiting.</p>
          ) : (
            <ul className="queue">
              {orders.map((o) => (
                <li key={o.id}>
                  <OrderRow
                    id={o.id}
                    ref_={o.ref}
                    /* Expected amount is on screen on purpose: a UPI intent's
                       `am` is editable and a static QR carries none, so a human
                       comparing this against the merchant app IS the amount
                       check. If it isn't visible, it doesn't happen. */
                    expected={rupees(o.amount_paise)}
                    utr={o.utr ?? ""}
                    who={o.profiles ? `@${o.profiles.handle}` : "unknown"}
                    what={o.kind === "pass_30d" ? "30-day pass" : (o.polls?.title ?? "poll")}
                    contact={o.contact}
                    when={o.submitted_at ? ago(new Date(o.submitted_at).getTime()) : ""}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
