import "server-only";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/payments";
import { ago } from "@/lib/format";

/**
 * Shared loaders for the admin section.
 *
 * Split out of the old single page so each area can own a route. There is
 * deliberately no admin RLS policy on `orders`, `entitlements` or `reports`
 * (RULES.md, admin), so the service-role client is the only path that can read
 * them — which is exactly why this file is `server-only`.
 */

/** 404, not 403 — don't confirm the route exists to someone probing for it. */
export async function requireAdmin() {
  const user = await getUser();
  if (!isAdmin(user?.id)) notFound();
  return createAdminClient();
}

/**
 * The clock, read outside any component.
 *
 * React's purity lint rejects `Date.now()` in a component body — and it sees
 * through `Promise.resolve(Date.now())` too.
 */
export async function clock() {
  return Date.now();
}

type Admin = ReturnType<typeof createAdminClient>;

export type QueueOrder = {
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

export async function loadOrders(supabase: Admin): Promise<QueueOrder[]> {
  const { data } = await supabase
    .from("orders")
    .select(
      `id, ref, kind, amount_paise, utr, contact, status, admin_note, created_at,
       submitted_at, decided_at,
       profiles:user_id(handle, display_name), polls:poll_id(slug, title)`
    )
    .eq("status", "submitted")
    .order("submitted_at", { ascending: true });

  return ((data ?? []) as unknown as (Omit<QueueOrder, "profiles" | "polls"> & {
    profiles: QueueOrder["profiles"] | QueueOrder["profiles"][];
    polls: QueueOrder["polls"] | QueueOrder["polls"][];
  })[]).map((o) => ({
    ...o,
    profiles: Array.isArray(o.profiles) ? (o.profiles[0] ?? null) : o.profiles,
    polls: Array.isArray(o.polls) ? (o.polls[0] ?? null) : o.polls,
  }));
}

/**
 * The moderation queue.
 *
 * `reports` has RLS on and only an insert policy — no select policy exists at
 * all, so the service role is the only reader by design. Grouped by target here
 * rather than in SQL: PostgREST cannot aggregate, and at this volume grouping a
 * few hundred rows in memory beats adding a view.
 */
export async function loadReports(supabase: Admin) {
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

/** Who currently has access, and how they got it. */
export async function loadGranted(supabase: Admin) {
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

/**
 * Search polls and Spaces by title/name/slug, for the admin delete screen.
 *
 * A search box rather than a list: this is the one unbounded delete in the
 * product, and a paginated list of everything invites scrolling to something and
 * removing it. You have to go looking for the thing you came to remove.
 *
 * `q` is escaped for PostgREST's `or` filter — a comma or a paren in the query
 * would otherwise be read as filter syntax. Same class of hole `keyFilter`
 * closes for slugs.
 */
export async function adminSearch(supabase: Admin, q: string) {
  const term = q.trim();
  if (term.length < 2) return { polls: [], spaces: [] };

  const safe = term.replace(/[(),*:"\\]/g, " ").trim();
  if (!safe) return { polls: [], spaces: [] };
  const like = `%${safe}%`;

  const [polls, spaces] = await Promise.all([
    supabase
      .from("polls")
      .select("id, slug, title, status, vote_count, created_at, spaces:space_id(name)")
      .or(`title.ilike.${like},slug.ilike.${like}`)
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("spaces")
      .select("id, slug, name, member_count, created_at")
      .or(`name.ilike.${like},slug.ilike.${like}`)
      .order("created_at", { ascending: false })
      .limit(25),
  ]);

  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

  return {
    polls: ((polls.data ?? []) as unknown as {
      id: string; slug: string; title: string; status: string; vote_count: number;
      spaces: { name: string } | { name: string }[] | null;
    }[]).map((p) => ({ ...p, spaceName: one(p.spaces)?.name ?? null })),
    spaces: (spaces.data ?? []) as {
      id: string; slug: string; name: string; member_count: number;
    }[],
  };
}

/** Counts for the hub, in one round trip each. `head: true` fetches no rows. */
export async function loadCounts(supabase: Admin) {
  const [orders, granted, reports] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "submitted"),
    supabase.from("entitlements").select("id", { count: "exact", head: true }),
    // Reports are counted after grouping, so this is rows-not-targets; the hub
    // says "reports", not "items", for exactly that reason.
    supabase.from("reports").select("target_id", { count: "exact", head: true }),
  ]);

  return {
    orders: orders.count ?? 0,
    granted: granted.count ?? 0,
    reports: reports.count ?? 0,
  };
}
