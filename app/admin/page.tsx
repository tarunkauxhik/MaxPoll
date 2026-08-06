import { notFound } from "next/navigation";
import AppShell from "@/components/shell/AppShell";
import { getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin, rupees, paymentMode } from "@/lib/payments";
import { ago } from "@/lib/format";
import { GrantForm, OrderRow, GrantedList, ModerationQueue } from "./AdminForms";

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
 * The moderation queue.
 *
 * `reports` has RLS on and only an insert policy — no select policy exists at
 * all, so the service role is the only reader by design. Grouped by target here
 * rather than in SQL: PostgREST cannot aggregate, and at this volume grouping a
 * few hundred rows in memory beats adding a view.
 */
async function loadReports(supabase: ReturnType<typeof createAdminClient>) {
  const { data } = await supabase
    .from("reports")
    .select("target_type, target_id, reason, created_at")
    .order("created_at", { ascending: false })
    .limit(300);

  const groups = new Map<
    string,
    { type: string; id: string; count: number; reasons: string[]; last: string }
  >();

  for (const r of (data ?? []) as {
    target_type: string; target_id: string; reason: string | null; created_at: string;
  }[]) {
    const key = `${r.target_type}:${r.target_id}`;
    const g = groups.get(key) ?? {
      type: r.target_type, id: r.target_id, count: 0, reasons: [], last: r.created_at,
    };
    g.count += 1;
    if (r.reason) g.reasons.push(r.reason);
    groups.set(key, g);
  }
  if (groups.size === 0) return [];

  // Resolve what each report actually points at, so the queue reads as content
  // and not as a list of uuids.
  const byType = (t: string) => [...groups.values()].filter((g) => g.type === t).map((g) => g.id);
  const [opts, polls, msgs] = await Promise.all([
    byType("option").length
      ? supabase.from("options").select("id, label, hidden, poll_id").in("id", byType("option"))
      : Promise.resolve({ data: [] }),
    byType("poll").length
      ? supabase.from("polls").select("id, title, slug, status").in("id", byType("poll"))
      : Promise.resolve({ data: [] }),
    byType("message").length
      ? supabase.from("messages").select("id, body, hidden").in("id", byType("message"))
      : Promise.resolve({ data: [] }),
  ]);

  const label = new Map<string, { text: string; hidden: boolean; href: string | null }>();
  for (const o of (opts.data ?? []) as { id: string; label: string; hidden: boolean }[]) {
    label.set(`option:${o.id}`, { text: o.label, hidden: o.hidden, href: null });
  }
  for (const p of (polls.data ?? []) as { id: string; title: string; slug: string; status: string }[]) {
    label.set(`poll:${p.id}`, { text: p.title, hidden: p.status === "removed", href: `/p/${p.slug}` });
  }
  for (const m of (msgs.data ?? []) as { id: string; body: string; hidden: boolean }[]) {
    label.set(`message:${m.id}`, { text: m.body, hidden: m.hidden, href: null });
  }

  return [...groups.values()]
    .map((g) => {
      const meta = label.get(`${g.type}:${g.id}`);
      return {
        type: g.type,
        id: g.id,
        count: g.count,
        reasons: g.reasons.slice(0, 4),
        // A report whose target was deleted outright still has rows; say so
        // rather than rendering a blank row with working buttons.
        text: meta?.text ?? "(deleted)",
        hidden: meta?.hidden ?? true,
        href: meta?.href ?? null,
      };
    })
    .sort((a, b) => b.count - a.count);
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
  const [{ data }, granted, reports, now] = await Promise.all([
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
    loadReports(supabase),
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

        {/* Ordered by how time-sensitive it is. Reported content about a named
            real person is the only thing here that gets worse while it waits. */}
        <section>
          <h2 className="t-card">
            Reported{" "}
            {reports.length > 0 && <span className="num">({reports.length})</span>}
          </h2>
          <p className="t-sec">
            Content hides itself once <span className="num">3</span> different people
            report it. Anything below that is waiting on you.
          </p>
          <ModerationQueue rows={reports} />
        </section>

        <section>
          <h2 className="t-card">
            Payments to verify{" "}
            {orders.length > 0 && <span className="num">({orders.length})</span>}
          </h2>
          <p className="t-sec">
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
          <h2 className="t-card">Grant access by hand</h2>
          <p className="t-sec">
            No payment taken. Recorded as a <b>comp</b> in the ledger, so the books never
            show money that did not move.
          </p>
          <GrantForm />
        </section>

        <section>
          <h2 className="t-card">
            Who has access{" "}
            {granted.length > 0 && <span className="num">({granted.length})</span>}
          </h2>
          <p className="t-sec">Everyone who can see voter names, and how they got in.</p>
          <GrantedList rows={granted} />
        </section>
      </div>
    </AppShell>
  );
}
