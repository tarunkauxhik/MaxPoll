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
  | { ok: false; code: "SIGNED_OUT" | "LOCKED" | "DUPLICATE" | "ERROR"; message: string };

export async function addOption(
  pollId: string,
  slug: string,
  label: string
): Promise<AddResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, code: "SIGNED_OUT", message: "Sign in to add a name." };

  const clean = label.trim().slice(0, 80);
  if (clean.length < 2) {
    return { ok: false, code: "ERROR", message: "That name is too short." };
  }

  // Options lock at 10 votes. Checked server-side: the client hides the field,
  // but that is presentation.
  const { data: poll } = await supabase
    .from("polls")
    .select("options_locked, status")
    .eq("id", pollId)
    .maybeSingle();

  if (!poll || poll.status !== "live") {
    return { ok: false, code: "LOCKED", message: "This poll is closed." };
  }
  if (poll.options_locked) {
    return {
      ok: false,
      code: "LOCKED",
      message: "Options are locked on this poll — it's past 10 votes.",
    };
  }

  const { error } = await supabase
    .from("options")
    .insert({ poll_id: pollId, label: clean, added_by: user.id });

  if (error) {
    return { ok: false, code: "ERROR", message: "Couldn't add that. Try again." };
  }

  revalidatePath(`/p/${slug}`);
  return { ok: true };
}

/** Report → auto-hide at 3 distinct reporters, enforced in the RPC. */
export async function report(targetType: "option" | "message" | "poll", targetId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("report_target", {
    p_type: targetType,
    p_id: targetId,
    p_reason: null,
  });
  return { ok: !error };
}
