import { redirect } from "next/navigation";
import AppShell from "@/components/shell/AppShell";
import { getUser } from "@/lib/supabase/server";
import { myAccess } from "@/lib/poll-queries";
import { paymentMode, PRICES, rupees } from "@/lib/payments";
import { startOrder } from "@/app/pay/actions";
import { Emoji } from "@/components/ui/Emoji";

export const metadata = { title: "Subscription · MaxPoll" };

const date = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

/**
 * Sells the 30-day pass, and — first — shows what the user already has.
 *
 * It used to answer only "is there a pass?", so somebody who had paid ₹9 to
 * unlock a poll opened this screen and saw the sales pitch, with no trace of the
 * purchase anywhere in the product. A per-poll unlock is a purchase; this page
 * is where you come to check one.
 *
 * Per-poll unlocks are still *bought* from inside the poll — that CTA needs a
 * specific poll and lives at /p/[slug]/unlock.
 */
export default async function SubscriptionPage() {
  const user = await getUser();
  if (!user) redirect("/");

  const { pass, unlocks } = await myAccess(user.id);
  const live = paymentMode() === "manual_upi";

  return (
    <AppShell>
      <div className="paywall">
        <a className="backlink" href="/settings">
          ← Settings
        </a>
        <h1 className="t-title">Subscription</h1>

        {/* ── What you already have ─────────────────────────────────────── */}
        {(pass || unlocks.length > 0) && (
          <section className="accessbox">
            <h2 className="t-label">Active now</h2>

            {pass && (
              <div className="accessrow">
                <span className="accessk">
                  <Emoji char="✅" /> 30-day pass
                </span>
                <span className="accessv">
                  {pass.expires_at ? `until ${date(pass.expires_at)}` : "no expiry"}
                </span>
              </div>
            )}

            {unlocks.map((u) => (
              <a
                key={u.poll_id}
                className="accessrow link"
                href={u.poll ? `/p/${u.poll.slug}` : "/"}
              >
                <span className="accessk">
                  <Emoji char="🔓" /> {u.poll?.title ?? "A poll"}
                </span>
                <span className="accessv">
                  names unlocked
                  <span className="accesschev" aria-hidden="true">
                    ›
                  </span>
                </span>
              </a>
            ))}

            <p className="hint">
              {pass
                ? "Unlimited polls, and every voter's name unlocked."
                : `${
                    unlocks.length === 1 ? "This poll shows" : "These polls show"
                  } you every voter's name. Other polls stay locked.`}
            </p>
          </section>
        )}

        {/* ── The pass ──────────────────────────────────────────────────── */}
        {!pass && (
          <>
            <h2 className="t-label">
              {unlocks.length > 0 ? "Unlock everything instead" : "The 30-day pass"}
            </h2>

            <ul className="perks">
              <li>Unlimited polls — no 3-per-week limit</li>
              <li>See every voter&apos;s name, on every poll</li>
              <li>30 days from activation</li>
            </ul>

            <p className="priceline">
              ₹<span className="num">{rupees(PRICES.pass_30d)}</span>
              <span className="t-sec"> for 30 days</span>
            </p>

            {live ? (
              <>
                <form action={startOrder.bind(null, "pass_30d", null, undefined)}>
                  <button type="submit" className="btn accent">
                    Get the 30-day pass
                  </button>
                </form>
                <form action={startOrder.bind(null, "pass_30d", null, undefined)}>
                  <button type="submit" className="btn sec">
                    Already paid?
                  </button>
                </form>
              </>
            ) : (
              /* Fails closed. With no VPA configured, paymentMode() returns
                 coming_soon on its own — lib/payments.ts. */
              <div className="comingsoon">
                <p>
                  <Emoji char="🔒" /> Unlocking soon
                </p>
                <p className="hint">
                  We&apos;re finishing payments. Nothing is charged and nothing is
                  collected yet.
                </p>
              </div>
            )}

            <p className="t-sec subline">
              Unlocking a single poll for ₹
              <span className="num">{rupees(PRICES.poll_unlock)}</span> instead happens
              from inside that poll, after you vote.
            </p>
          </>
        )}

        <a className="btn sec" href="/settings">
          Back to Settings
        </a>
      </div>
    </AppShell>
  );
}
