import { redirect } from "next/navigation";
import AppShell from "@/components/shell/AppShell";
import { getUser } from "@/lib/supabase/server";
import { activePass } from "@/lib/poll-queries";
import { paymentMode, PRICES, rupees } from "@/lib/payments";
import { startOrder } from "@/app/pay/actions";
import { Emoji } from "@/components/ui/Emoji";

export const metadata = { title: "Subscription · MaxPoll" };

/**
 * Sells only the 30-day pass — per-poll ₹9 unlocks need a specific poll, so
 * that CTA lives at /p/[slug]/unlock, not here. Same pattern as that page:
 * AppShell, paymentMode()-gated live/coming-soon branch, same perks copy.
 */
export default async function SubscriptionPage() {
  const user = await getUser();
  if (!user) redirect("/");

  const { pass } = await activePass(user.id);
  const live = paymentMode() === "manual_upi";

  return (
    <AppShell>
      <div className="paywall">
        <a className="backlink" href="/settings">
          ← Settings
        </a>
        <h1 className="t-title">Subscription</h1>

        {pass ? (
          <div className="comingsoon">
            <p>
              <Emoji char="✅" /> 30-day pass active
              {pass.expires_at
                ? ` until ${new Date(pass.expires_at).toLocaleDateString("en-IN")}`
                : ""}
              .
            </p>
            <p className="hint">Unlimited polls, and every voter&apos;s name unlocked.</p>
          </div>
        ) : (
          <>
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
              <form action={startOrder.bind(null, "pass_30d", null, undefined)}>
                <button type="submit" className="btn accent">
                  Get the 30-day pass
                </button>
              </form>
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

            {live && (
              <form action={startOrder.bind(null, "pass_30d", null, undefined)}>
                <button type="submit" className="btn sec">
                  Already paid?
                </button>
              </form>
            )}
          </>
        )}

        <p className="t-sec subline">
          Unlocking a single poll for ₹
          <span className="num">{rupees(PRICES.poll_unlock)}</span> instead happens
          from inside that poll, after you vote.
        </p>

        <a className="btn sec" href="/settings">
          Back to Settings
        </a>
      </div>
    </AppShell>
  );
}
