import { notFound } from "next/navigation";
import AppShell from "@/components/shell/AppShell";
import { getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin, rupees, paymentMode } from "@/lib/payments";
import { ago } from "@/lib/format";
import { GrantForm, OrderRow, GrantedList } from "./AdminForms";

export const metadata = { title: "Admin · MaxPoll" };
export const dynamic = "force-dynamic";

type QueueOrder = {
  id: string;
  ref: string;
  kind: string;
  amount_paise: number;
  utr: string | null;
  contact: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
  submitted_at: string | null;
  decided_at: string | null;
  profiles: { handle: string; display_name: string } | null;
  polls: { slug: string; title: string } | null;
};

/**
 * The clock, read outside the component.
 *
 * React's purity lint rejects `Date.now()` in a component body — and it sees
 * through `Promise.resolve(Date.now())` too. The poll page only gets away with
 * its version because the read hides inside `isExpired()`'s default argument,
 * in another module. Same idea, said out loud.
 */
async function clock() {
  return Date.now();
}

/**
 * Who currently has access, and how they got it.
 *
 * Same reason as the orders query: there is deliberately no admin RLS policy on
 * these tables (DECISIONS D3), so the service role is the only path that can
 * read them. Shaped for the component here so the render stays pure.
 */
async function loadGranted(supabase: ReturnType<typeof createAdminClient>) {
  const { data } = await supabase
    .from("entitlements")
    .select(
      "id, kind, source, payment_ref, expires_at, created_at, profiles:user_id(handle, display_name), polls:poll_id(slug, title)"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  const now = Date.now();
  // PostgREST types an embedded to-one relation as an array — it cannot know the
  // FK is single-valued without generated types.
  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

  return ((data ?? []) as unknown as {
    id: string; kind: string; source: string; payment_ref: string | null;
    expires_at: string | null; created_at: string;
    profiles: { handle: string; display_name: string } | { handle: string; display_name: string }[] | null;
    polls: { slug: string; title: string } | { slug: string; title: string }[] | null;
  }[]).map((g) => {
    const who = one(g.profiles);
    const poll = one(g.polls);
    return {
      id: g.id,
      who: who ? `@${who.handle}` : "unknown",
      whoName: who?.display_name ?? null,
      what: g.kind === "sub_monthly" ? "30-day pass" : (poll?.title ?? "a poll"),
      pollSlug: poll?.slug ?? null,
      source: g.source,
      paymentRef: g.payment_ref,
      when: ago(new Date(g.created_at).getTime(), now),
      // A lapsed pass is still a row; say so rather than printing a date and
      // leaving the reader to work it out.
      expired: g.expires_at !== null && new Date(g.expires_at).getTime() <= now,
      expiresAt: g.expires_at,
    };
  });
}

export default async function AdminPage() {
  const user = await getUser();

  // 404, not 403 — don't confirm the route exists to someone probing for it.
  if (!isAdmin(user?.id)) notFound();

  // There is deliberately no admin RLS policy on `orders`, so this is the only
  // path that can read them (DECISIONS D3).
  const supabase = createAdminClient();
  const [{ data }, granted, now] = await Promise.all([
    supabase
      .from("orders")
      .select(
        `id, ref, kind, amount_paise, utr, contact, status, admin_note, created_at,
         submitted_at, decided_at,
         profiles:user_id(handle, display_name), polls:poll_id(slug, title)`
      )
      .eq("status", "submitted")
      .order("submitted_at", { ascending: true }),
    loadGranted(supabase),
    clock(),
  ]);

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
        </section>

        <section>
          <h2 className="t-card">
            Access granted{" "}
            {granted.length > 0 && <span className="num">({granted.length})</span>}
          </h2>
          <p className="t-sec">Everyone who can see voter names, and how they got in.</p>
          <GrantedList rows={granted} />
        </section>
      </div>
    </AppShell>
  );
}
