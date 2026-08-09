import { notFound, redirect } from "next/navigation";
import AppShell from "@/components/shell/AppShell";
import { getPollBySlug, hasEntitlement } from "@/lib/poll-queries";
import { getUser } from "@/lib/supabase/server";
import { resultsLocked } from "@/lib/space";
import { paymentsEnabled, PRICES, rupees } from "@/lib/payments";
import { startOrder } from "@/app/pay/actions";
import { Emoji } from "@/components/ui/Emoji";

export const metadata = { title: "See who voted · MaxPoll" };

/**
 * The paywall — doc 03 §G. Same copy, perks and price regardless of mode; only
 * the CTA changes. Reached by scrolling to locked content after voting, never
 * on arrival.
 */
export default async function UnlockPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const poll = await getPollBySlug(slug);
  if (!poll) notFound();

  const user = await getUser();
  if (!user) redirect(`/p/${slug}`);
  if (await hasEntitlement(poll.id, user.id)) redirect(`/p/${slug}`);

  // The 20-member gate hides results from everyone, entitlement or not, so ₹9
  // here would buy a board that stays blank. The board hides the CTA already;
  // this is the guard, because a URL is typeable and links go stale.
  if (resultsLocked(poll)) redirect(`/p/${slug}`);

  const live = paymentsEnabled();

  return (
    <AppShell>
      <div className="paywall">
        <h1 className="t-title">
          <Emoji char="👀" /> See the exact names of voters
        </h1>

        <ul className="perks">
          <li>Exact names of voters on every option</li>
          <li>Exact counts &amp; the full under-list</li>
          <li>Who voted the same as you</li>
        </ul>

        <p className="priceline">
          ₹<span className="num">{rupees(PRICES.poll_unlock)}</span>
          <span className="t-sec"> one time · this poll</span>
        </p>

        {live ? (
          <form
            action={async () => {
              "use server";
              await startOrder("poll_unlock", poll.id, poll.slug);
            }}
          >
            {/* No rail in the label. Which one runs is a deploy-time switch,
                and "with UPI" was wrong the moment Razorpay took cards too. */}
            <button type="submit" className="btn accent">
              Pay ₹<span className="num">{rupees(PRICES.poll_unlock)}</span>
            </button>
          </form>
        ) : (
          /* Fails closed. With no VPA (or no matching Razorpay key) configured,
             paymentMode() returns coming_soon on its own — lib/payments.ts. The
             sheet still renders identically, which is what measures real intent. */
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
          ₹<span className="num">{rupees(PRICES.pass_30d)}</span> unlocks every poll
          for 30 days + unlimited creating
        </p>

        {live && (
          <form
            action={async () => {
              "use server";
              await startOrder("pass_30d", null);
            }}
          >
            <button type="submit" className="btn sec">
              Get the 30-day pass
            </button>
          </form>
        )}

        <a className="btn sec" href={`/p/${slug}`}>
          Back to the poll
        </a>
      </div>
    </AppShell>
  );
}
