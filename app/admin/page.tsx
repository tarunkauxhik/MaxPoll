import AppShell from "@/components/shell/AppShell";
import { paymentMode } from "@/lib/payments";
import { requireAdmin, loadCounts } from "./data";

export const metadata = { title: "Admin · MaxPoll" };
export const dynamic = "force-dynamic";

/**
 * The admin hub.
 *
 * Everything used to live on one page: four sections stacked in a single column
 * with no boundary between them, so the moderation queue, the payment queue, a
 * grant form and the access list all ran together and the page got longer the
 * busier things were. Each area is its own route now, and this screen's only job
 * is to say what is waiting and send you there.
 *
 * Ordered by how time-sensitive each one is. Reported content about a named real
 * person is the only thing here that gets worse while it waits.
 */
type Counts = { reports: number; orders: number; granted: number };

/**
 * Each area writes its own footer line. A shared `${n} ${unit}` template read
 * fine for the two queues and produced "Nothing waiting" on the access list,
 * which is not a queue and has nothing to wait for.
 */
const AREAS: {
  href: string;
  title: string;
  blurb: string;
  /** Badge count, or null for an area with nothing to count. */
  count: (c: Counts) => number | null;
  foot: (c: Counts) => string;
}[] = [
  {
    href: "/admin/reports",
    title: "Reported",
    blurb:
      "Content hides itself once 3 different people report it. Anything below that is waiting on you.",
    count: (c) => c.reports,
    foot: (c) =>
      c.reports === 0 ? "Nothing reported" : `${c.reports} report${c.reports === 1 ? "" : "s"}`,
  },
  {
    href: "/admin/payments",
    title: "Payments to verify",
    blurb:
      "Check the UTR against your UPI app, then verify. Verifying grants access in the same transaction.",
    count: (c) => c.orders,
    foot: (c) => (c.orders === 0 ? "Nothing waiting" : `${c.orders} waiting`),
  },
  {
    href: "/admin/grant",
    title: "Grant access by hand",
    blurb:
      "No payment taken. Recorded as a comp in the ledger, so the books never show money that did not move.",
    count: () => null,
    foot: () => "Open the form",
  },
  {
    href: "/admin/access",
    title: "Who has access",
    blurb: "Everyone who can see voter names, and how they got in.",
    count: () => null,
    foot: (c) =>
      c.granted === 0 ? "Nobody yet" : `${c.granted} ${c.granted === 1 ? "person" : "people"}`,
  },
  {
    href: "/admin/remove",
    title: "Remove a poll or Space",
    blurb:
      "Search, then delete, whoever made it. This ignores the ownership rules a creator's own delete follows — deleting a Space deletes every poll in it.",
    count: () => null,
    foot: () => "Search",
  },
];

export default async function AdminPage() {
  const supabase = await requireAdmin();
  const counts = await loadCounts(supabase);
  const live = paymentMode() === "manual_upi";

  return (
    <AppShell>
      <div className="adminwrap">
        <h1 className="t-title">Admin</h1>

        {!live && (
          <p className="notice">
            Payments are <b>off</b> — no VPA is configured, so no UPI orders can
            arrive. Grant access by hand instead.
          </p>
        )}

        <nav className="adminhub">
          {AREAS.map((a) => {
            const badge = a.count(counts);
            return (
              <a className="adminhub-card" href={a.href} key={a.href}>
                <span className="adminhub-h">
                  <span className="adminhub-t">{a.title}</span>
                  {badge !== null && badge > 0 && (
                    <span className="adminhub-n num">{badge}</span>
                  )}
                </span>
                <span className="adminhub-s">{a.blurb}</span>
                <span className="adminhub-f">
                  {a.foot(counts)}
                  <span aria-hidden="true"> →</span>
                </span>
              </a>
            );
          })}
        </nav>
      </div>
    </AppShell>
  );
}
