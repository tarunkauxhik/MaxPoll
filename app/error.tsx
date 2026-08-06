"use client";

import { useEffect } from "react";
import Link from "next/link";
import AppShell from "@/components/shell/AppShell";
import { ErrorState } from "@/components/ui/States";

/**
 * Any uncaught render or data error below the root layout.
 *
 * Without this file a crash showed Next's raw framework screen — in production
 * that is an unstyled page with no navigation, which reads as "the site is
 * broken" rather than "this page is". The nav survives, so the rest of the
 * product stays reachable.
 *
 * `reset()` re-renders the segment. Worth offering because most failures here
 * are a transient Supabase read, not a code fault.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // There is no error-monitoring service yet, so this is the only record. It
    // reaches the Vercel function logs, where `digest` is the string that ties a
    // user's report to the actual stack trace.
    console.error("render error", error.digest, error);
  }, [error]);

  return (
    <AppShell>
      <ErrorState
        message="Something broke on our side. Nothing you did caused it, and nothing you've voted on was lost."
        onRetry={reset}
      />
      <p className="hint lcenter">
        <Link href="/">Back to the feed</Link>
      </p>
    </AppShell>
  );
}
