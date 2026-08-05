import AppShell from "@/components/shell/AppShell";
import Link from "next/link";
import { CONTACT_EMAIL, LEGAL_UPDATED } from "../legal";
import { PRICES, rupees } from "@/lib/payments";

export const metadata = {
  title: "Terms · MaxPoll",
  description: "The rules for using MaxPoll, and what you get when you pay.",
};

/**
 * Required alongside /privacy before the Google OAuth app can be published.
 *
 * Prices come from lib/payments.ts rather than being typed here, so this page
 * cannot quietly disagree with what the payment screen charges.
 */
export default function TermsPage() {
  return (
    <AppShell>
      <div className="setwrap">
        <h1 className="t-title">Terms of use</h1>
        <p className="hint">Last updated {LEGAL_UPDATED}</p>

        <section>
          <h2 className="t-label">Who can use MaxPoll</h2>
          <p>
            You must be 18 or over, and you must give a real date of birth when you sign
            up. One account per person.
          </p>
        </section>

        <section>
          <h2 className="t-label">Voting</h2>
          <p>
            One vote per poll, and votes are final — there is no changing or taking one
            back. Your name is recorded against your vote and is shown to people who
            have unlocked that poll. See <Link href="/privacy">Privacy</Link>.
          </p>
          <p>
            Do not try to rig a poll: no second accounts, no scripts, no paying people
            to vote. We remove votes and accounts that do.
          </p>
        </section>

        <section>
          <h2 className="t-label">What you post</h2>
          <p>
            You are responsible for the polls you create, the names you add and the
            messages you send. Nothing that harasses, threatens or sexualises anyone, and
            nothing about a real person who has asked to be left out of it.
          </p>
          <p>
            Anyone can report a poll, an option or a message. Three separate reports
            hide it automatically while it is looked at. We can remove any content or
            account, at any time, without notice.
          </p>
          <p>
            Polls are about real people. Treat that as the responsibility it is — a
            leaderboard is still a thing someone has to read about themselves.
          </p>
        </section>

        <section>
          <h2 className="t-label">Paying</h2>
          <p>
            Two things can be bought: unlocking the voter names on a single poll for ₹
            <span className="num">{rupees(PRICES.poll_unlock)}</span>, and a pass that
            unlocks every poll for 30 days for ₹
            <span className="num">{rupees(PRICES.pass_30d)}</span>. The pass expires
            after 30 days and does not renew itself. Nothing on MaxPoll is a
            subscription and nothing auto-charges you.
          </p>
          <p>
            Payment is by UPI, from your own UPI app, to the account shown on the payment
            screen. You then submit the 12-digit reference number and{" "}
            <strong>a human checks it against the bank record before access is
            granted</strong>. That is usually quick but it is not instant, and it is not
            automatic.
          </p>
          <p>
            <strong>Unlocks are non-refundable once access has been granted.</strong> If
            we cannot match your payment and therefore cannot grant access, tell us and
            we will return it. Pay the exact amount shown — a different amount is much
            harder to match, and an unmatched payment is the one thing that turns a ₹
            <span className="num">{rupees(PRICES.poll_unlock)}</span> purchase into an
            email exchange.
          </p>
          <p>
            Access is to voter names, not to any particular result. Polls close, people
            change their minds and options get merged or removed by moderation; none of
            that is a refundable fault.
          </p>
        </section>

        <section>
          <h2 className="t-label">Availability</h2>
          <p>
            MaxPoll is provided as-is, with no promise that it will be available or
            uninterrupted, and no liability for anything you lose by relying on it. It
            runs on free infrastructure and can go down.
          </p>
        </section>

        <section>
          <h2 className="t-label">Changes</h2>
          <p>
            These terms can change. The date at the top says when they last did. If a
            change matters, continuing to use MaxPoll means you accept it.
          </p>
        </section>

        <section>
          <h2 className="t-label">Contact</h2>
          <p>
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </p>
        </section>

        <section>
          <p className="hint">
            <Link href="/privacy">Privacy</Link>
          </p>
        </section>
      </div>
    </AppShell>
  );
}
