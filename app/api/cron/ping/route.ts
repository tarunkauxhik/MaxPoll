import { createAnonClient } from "@/lib/supabase/anon";
import { clean } from "@/lib/env";
import { NextResponse } from "next/server";

/**
 * The one daily job. Two responsibilities, deliberately split by trust level.
 *
 * **Keep-alive.** Supabase free projects pause after ~7 days without database
 * activity, and a paused project is a dead site. One trivial query does it.
 *
 * **Closing expired polls.** `polls.status` never left 'live' on its own, so the
 * landing page counted dead polls as live and `poll_closed` could never fire —
 * see the 20260806140000 migration.
 *
 * The guard is split rather than absolute:
 *
 *   CRON_SECRET unset          → keep-alive only, and the response says so
 *   set + header matches       → keep-alive AND close expired polls
 *   set + header wrong/missing → 401, nothing runs
 *
 * Failing closed on everything would stop the keep-alive, and a Supabase project
 * that pauses after seven days is a worse outcome than an unauthenticated count
 * query. The write path always needs the secret.
 *
 * Hobby crons **time out at 10s**, so this stays two statements. Exactly one cron
 * is allowed, once daily — any sub-daily schedule fails at deploy time. Do not
 * add another (CLAUDE.md).
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = clean("CRON_SECRET", process.env.CRON_SECRET);
  const authorised =
    secret !== "" && request.headers.get("authorization") === `Bearer ${secret}`;

  if (secret !== "" && !authorised) {
    return NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 });
  }

  const supabase = createAnonClient();
  const { error } = await supabase
    .from("spaces")
    .select("id", { count: "exact", head: true });

  let closed: number | null = null;
  if (authorised) {
    const { data } = await supabase.rpc("close_expired_polls");
    closed = data ?? 0;
  }

  return NextResponse.json({
    ok: !error,
    closed,
    // Surfaced in the response and the logs, so an unset secret cannot go quiet.
    ...(secret === "" ? { guard: "CRON_SECRET not set — keep-alive only" } : {}),
    at: new Date().toISOString(),
  });
}
