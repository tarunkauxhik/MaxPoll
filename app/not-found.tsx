import Link from "next/link";
import AppShell from "@/components/shell/AppShell";
import { EmptyState } from "@/components/ui/States";

export const metadata = { title: "Not found · MaxPoll" };

/**
 * The most likely bad link in this product is a poll link that got mangled on
 * its way through a WhatsApp group, or one whose poll was removed — and until
 * now both landed on Next's stock 404, which has no navigation at all. Someone
 * arriving from a group chat could not get anywhere from here.
 *
 * Rendered inside `AppShell`, so the nav is present and the dead end isn't one.
 * Copy is an instruction, not an apology — RULES.md.
 */
export default function NotFound() {
  return (
    <AppShell>
      <EmptyState
        icon="🔍"
        message="This link doesn't go anywhere. The poll may have been removed, or the link got cut short on its way here."
        action={
          <Link className="btn pri" href="/">
            Go to the feed
          </Link>
        }
      />
    </AppShell>
  );
}
