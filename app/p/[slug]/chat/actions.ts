"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * The insert lives in `send_message()` now, not here.
 *
 * Everything below is UX — trimming before the round trip, turning an error code
 * into a sentence. The rules themselves (300 chars, 10 a minute, poll must be
 * live) are enforced in the database, because this action was never the only way
 * to reach the table: any signed-in client could POST straight to
 * `/rest/v1/messages` with the publishable key. Migration 20260805140000.
 *
 * The anonymous handle is derived inside the function too. Passed as a parameter
 * it would let a caller post under someone else's pseudonym.
 */
export async function sendMessage(pollId: string, body: string, anon: boolean) {
  const supabase = await createClient();

  const text = body.trim().slice(0, 300);
  if (!text) return { ok: false, message: "Type something first." };

  const { error } = await supabase.rpc("send_message", {
    p_poll: pollId,
    p_body: text,
    p_anon: anon,
  });

  if (!error) return { ok: true, message: "" };

  const code = error.message ?? "";
  if (code.includes("SIGNED_OUT")) return { ok: false, message: "Sign in to chat." };
  if (code.includes("RATE_LIMITED")) return { ok: false, message: "Slow down a second." };
  if (code.includes("CLOSED")) return { ok: false, message: "This poll is closed." };
  return { ok: false, message: "Couldn't send. Try again." };
}
