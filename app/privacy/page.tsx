import AppShell from "@/components/shell/AppShell";
import Link from "next/link";
import { CONTACT_EMAIL, LEGAL_UPDATED } from "../legal";

export const metadata = {
  title: "Privacy · MaxPoll",
  description: "What MaxPoll collects, what is public, and how to delete it all.",
};

/**
 * Required before the Google OAuth app can be published — the Branding step
 * rejects a privacy policy URL that does not resolve.
 *
 * Every claim here is checked against the code rather than lifted from a
 * template. If you change what the app stores, change this page in the same
 * commit. The three that go stale fastest: the delete behaviour in
 * app/settings/actions.ts, the columns in the initial-schema migration, and the
 * Analytics section — that one already went stale once, the moment
 * @vercel/analytics landed in package.json while this page still said "there are
 * no analytics on this site".
 *
 * No new CSS — .setwrap / .t-title / .t-label / .hint all already exist.
 */
export default function PrivacyPage() {
  return (
    <AppShell>
      <div className="setwrap">
        <h1 className="t-title">Privacy</h1>
        <p className="hint">Last updated {LEGAL_UPDATED}</p>

        <section>
          <h2 className="t-label">The short version</h2>
          <p>
            MaxPoll is a public voting app. Polls, options and results are meant to be
            seen. <strong>Your name is attached to your votes</strong>, and people who
            have paid to unlock a poll can see it. That is the product, not a setting
            you can turn off — so vote accordingly.
          </p>
          <p>
            There are <strong>no advertising trackers</strong> on this site, and
            nothing here follows you to another one. The only third-party script is
            Vercel Web Analytics, described below.
          </p>
        </section>

        <section>
          <h2 className="t-label">What we collect</h2>
          <p>
            <strong>From Google, when you sign in:</strong> your email address and the
            name on your Google account. We never receive your Google password. There
            are no passwords on MaxPoll at all.
          </p>
          <p>
            <strong>From you, once, at sign-up:</strong> a handle, a display name, your
            date of birth, and optionally a short bio and your Instagram, X or Snapchat
            handles.
          </p>
          <p>
            Your date of birth is used for one thing — checking that you are 18 or over.
            It is never shown on any screen and is never sent to your browser.
          </p>
          <p>
            <strong>As you use MaxPoll:</strong> the polls you create, the options you
            add, your votes, and your chat messages. Each vote also stores a random
            identifier for the browser it came from, which we use to spot vote-rigging.
            It is not linked to your device by us and tells us nothing about it.
          </p>
          <p>
            <strong>If you pay:</strong> the email or phone number you type on the
            payment screen, and the 12-digit UPI reference number of your payment.{" "}
            <strong>No card, UPI PIN or bank details ever reach MaxPoll</strong> — the
            payment happens entirely inside your own UPI app.
          </p>
        </section>

        <section>
          <h2 className="t-label">What other people can see</h2>
          <p>
            Public to anyone: your handle, display name, bio, any social handles you
            added, the polls you create and the options you add.
          </p>
          <p>
            <strong>Who you voted for</strong> is visible to anyone holding a paid
            unlock for that poll, or an active pass. Everyone else sees only the counts.
          </p>
          <p>
            Posting in a poll&apos;s chat anonymously hides your name from other users,
            not from us. We keep the link so that reported messages can be moderated.
          </p>
          <p>Your email address and date of birth are never shown to anyone.</p>
        </section>

        <section>
          <h2 className="t-label">Where it is stored</h2>
          <p>
            In India. The database is hosted by Supabase in AWS Mumbai
            (<code>ap-south-1</code>), and the app runs on Vercel&apos;s Mumbai region.
            Both companies act as our processors and neither uses your data for their
            own purposes.
          </p>
          <p>
            Signing in sets a session cookie so you stay signed in. That is the only
            cookie MaxPoll sets, and it is not used for tracking.
          </p>
        </section>

        <section>
          <h2 className="t-label">Analytics</h2>
          <p>
            We use <strong>Vercel Web Analytics</strong> to count page views. It sets{" "}
            <strong>no cookies</strong> and builds no profile of you: visitors are
            counted using a hash of the incoming request that is discarded after 24
            hours, and it cannot follow you to any other website.
          </p>
          <p>
            What it records per view: the page URL, the referring site, your country
            and city, your device type, and your browser and operating system version.
            It does not receive your name, handle, email or IP address.
          </p>
          <p>
            Two URLs are deliberately blurred before they leave your browser —
            profile pages become <code>/u/[handle]</code> and payment pages become{" "}
            <code>/pay/[ref]</code> — so a page view can never name a person or a
            payment.
          </p>
        </section>

        <section>
          <h2 className="t-label">Deleting your account</h2>
          <p>
            <Link href="/settings">Settings</Link> → Delete account. It is immediate and
            we do not ask you to email anyone.
          </p>
          <p>
            That removes your profile, memberships, notifications, unlocks and
            your login. <strong>Your votes and chat messages are kept, with the link to
            you permanently removed</strong> — every poll&apos;s totals are built from
            those rows, so deleting them would silently corrupt results other people
            are still looking at. Once detached they cannot be traced back to you, by us
            or anyone else.
          </p>
        </section>

        <section>
          <h2 className="t-label">Children</h2>
          <p>
            MaxPoll is for people aged 18 and over. If you tell us you are under 18 at
            sign-up you cannot create an account.
          </p>
        </section>

        <section>
          <h2 className="t-label">Contact</h2>
          <p>
            Questions, or a request to see or correct your data:{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>
        </section>

        <section>
          <p className="hint">
            <Link href="/terms">Terms of use</Link>
          </p>
        </section>
      </div>
    </AppShell>
  );
}
