"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type ManageState = { error?: string; ok?: string };

/**
 * Poll owner controls — doc 06 had none, and `polls` is not client-updatable at
 * all (20260806110000 revoked `update` and dropped `polls_update`, because RLS
 * picks rows and not columns and a creator could otherwise rewrite vote_count).
 *
 * So every write here goes through `update_poll()` / `delete_poll()`, which are
 * `security definer` and take identity from `auth.uid()`. **The ownership check
 * is in the database, not in this file.** A Server Action is a public HTTP
 * endpoint; a guard here would only be a nicer error message.
 */

const MESSAGES: Record<string, string> = {
  NOT_OWNER: "That isn't your poll.",
  SIGNED_OUT: "You're signed out. Sign in again.",
  NO_POLL: "That poll no longer exists.",
  REMOVED: "This poll was removed by moderation and can't be edited.",
  TITLE_TOO_SHORT: "Give the poll a title people will recognise.",
  EXPIRY_IN_PAST: "Pick a deadline in the future.",
  EXPIRY_TOO_FAR: "A poll can run for 7 days at most.",
  HAS_VOTES: "People have voted, so this can't be deleted. Close it instead.",
};

function explain(message: string | undefined) {
  const hit = Object.keys(MESSAGES).find((k) => message?.includes(k));
  return hit ? MESSAGES[hit] : "Couldn't save that. Try again.";
}

export async function updatePoll(_prev: ManageState, form: FormData): Promise<ManageState> {
  const supabase = await createClient();

  const pollId = String(form.get("poll_id") ?? "");
  const slug = String(form.get("slug") ?? "");
  const title = String(form.get("title") ?? "").trim();
  const expiresRaw = String(form.get("expires_at") ?? "").trim();
  const close = form.get("close") === "1";
  const lock = form.get("lock_options");

  // "keep" means the field was left alone. Distinct from "none", which clears
  // the deadline — `update_poll` needs those to be two different signals or an
  // untouched form would silently remove someone's timer.
  const expires = expiresRaw && expiresRaw !== "keep" && expiresRaw !== "none" ? expiresRaw : null;

  const { error } = await supabase.rpc("update_poll", {
    p_poll: pollId,
    p_title: title || null,
    p_expires: expires,
    p_clear_expiry: expiresRaw === "none",
    p_close: close,
    p_lock_options: lock === null ? null : lock === "1",
  });

  if (error) return { error: explain(error.message) };

  revalidatePath(`/p/${slug}`);
  return { ok: close ? "Poll closed." : "Saved." };
}

/**
 * The +1h/+6h/+24h buttons on Manage poll. Reads the poll's current deadline
 * from the database rather than trusting a client-computed timestamp — the
 * base for "+Nh" has to be the real current deadline (or now, if there is
 * none), and the database is the only place both are known for certain.
 */
export async function extendPoll(
  pollId: string,
  slug: string,
  hours: number
): Promise<ManageState> {
  const supabase = await createClient();

  const { data: poll } = await supabase
    .from("polls")
    .select("expires_at")
    .eq("id", pollId)
    .maybeSingle();
  if (!poll) return { error: "That poll no longer exists." };

  const base = poll.expires_at ? new Date(poll.expires_at).getTime() : Date.now();
  const next = new Date(base + hours * 3600e3).toISOString();

  const { error } = await supabase.rpc("update_poll", { p_poll: pollId, p_expires: next });
  if (error) return { error: explain(error.message) };

  revalidatePath(`/p/${slug}`);
  return { ok: `Extended by ${hours}h.` };
}

export async function deletePoll(_prev: ManageState, form: FormData): Promise<ManageState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_poll", {
    p_poll: String(form.get("poll_id") ?? ""),
  });

  if (error) return { error: explain(error.message) };

  // The poll is gone, so there is nothing to revalidate back to.
  redirect("/?deleted=1");
}
