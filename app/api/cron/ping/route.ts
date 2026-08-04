import { createAnonClient } from "@/lib/supabase/anon";
import { NextResponse } from "next/server";

/**
 * Keep-alive. Supabase free projects pause after ~7 days without database
 * activity, and a paused project is a dead site.
 *
 * Hobby crons **time out at 10s**, so this does one trivial query and nothing
 * else. Anything heavier here fails silently at 3am and the project pauses anyway.
 *
 * Exactly one cron is allowed on Hobby, once daily — any sub-daily schedule fails
 * at deploy time. This is that one. Do not add another (CLAUDE.md).
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createAnonClient();
  const { error } = await supabase
    .from("spaces")
    .select("id", { count: "exact", head: true });

  return NextResponse.json({ ok: !error, at: new Date().toISOString() });
}
