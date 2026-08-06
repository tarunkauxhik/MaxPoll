"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type Suggestion = { id: string; label: string; vote_count: number; rank: number };

/** Trigram typeahead over `search_options()`. Returns rank + count, because
 *  "#2 · 82 votes" is what actually stops someone adding a duplicate. */
export async function searchOptions(pollId: string, query: string): Promise<Suggestion[]> {
  if (query.trim().length < 2) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("search_options", {
    p_poll: pollId,
    p_query: query,
  });
  return (data ?? []) as Suggestion[];
}

export type AddResult =
  | { ok: true }
  | {
      ok: false;
      code: "SIGNED_OUT" | "LOCKED" | "DUPLICATE" | "RATE_LIMITED" | "CAPPED" | "ERROR";
      message: string;
    };

const ADD_ERRORS: Record<string, AddResult & { ok: false }> = {
  SIGNED_OUT: { ok: false, code: "SIGNED_OUT", message: "Sign in to add a name." },
  TOO_SHORT: { ok: false, code: "ERROR", message: "That name is too short." },
  CLOSED: { ok: false, code: "LOCKED", message: "This poll is closed." },
  LOCKED: {
    ok: false,
    code: "LOCKED",
    message: "Options are locked on this poll — it's past 10 votes.",
  },
  OPTION_CAP: { ok: false, code: "CAPPED", message: "This poll is full at 60 options." },
  RATE_LIMITED: {
    ok: false,
    code: "RATE_LIMITED",
    message: "You've added a lot of names just now. Try again in a bit.",
  },
};

/**
 * Every check that used to live here — signed in, length, poll live, not locked —
 * is now inside `add_option()`. Two reasons, and the second is the one that
 * matters:
 *
 *  1. The read-then-insert here was a race. Two submits could both see
 *     `option_count = 59`. The function holds a row lock instead.
 *  2. This action was never the only door. `options` was directly insertable by
 *     any signed-in client, so "locked at 10 votes" was a promise the UI made
 *     and the database did not keep. Migration 20260805140000.
 */
export async function addOption(
  pollId: string,
  slug: string,
  label: string
): Promise<AddResult> {
  const supabase = await createClient();

  const { error } = await supabase.rpc("add_option", {
    p_poll: pollId,
    p_label: label.trim().slice(0, 80),
  });

  if (error) {
    const hit = Object.keys(ADD_ERRORS).find((code) => error.message?.includes(code));
    return hit
      ? ADD_ERRORS[hit]
      : { ok: false, code: "ERROR", message: "Couldn't add that. Try again." };
  }

  revalidatePath(`/p/${slug}`);
  return { ok: true };
}

/**
 * Report → auto-hide at 3 distinct reporters, enforced in the RPC.
 *
 * `reports_once_uniq` makes a second report from the same person a no-op, so
 * three reports really means three people — one account cannot hide anything on
 * its own.
 *
 * This had no caller for its entire life while `/terms` told users "anyone can
 * report a poll, an option or a message". doc 01 rates person-poll defamation a
 * High risk and names this as the mitigation.
 */
export async function report(
  targetType: "option" | "message" | "poll",
  targetId: string,
  reason?: string
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("report_target", {
    p_type: targetType,
    p_id: targetId,
    p_reason: reason?.trim() || null,
  });

  if (error) {
    if (error.message?.includes("SIGNED_OUT")) {
      return { ok: false, message: "Sign in to report." };
    }
    return { ok: false, message: "Couldn't send that report. Try again." };
  }
  return { ok: true };
}
