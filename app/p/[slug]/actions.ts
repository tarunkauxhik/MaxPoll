"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type VoteResult =
  | { ok: true }
  | { ok: false; code: "SIGNED_OUT" | "ALREADY_VOTED" | "CLOSED" | "ERROR"; message: string };

/**
 * Cast a vote through `cast_vote()`.
 *
 * The RPC inserts the vote and increments both denormalised counters in ONE
 * transaction — never `count(*)`, and never two round trips that could half-fail
 * and leave a counter lying about the board.
 */
export async function castVote(
  pollId: string,
  optionId: string,
  slug: string,
  deviceId: string
): Promise<VoteResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, code: "SIGNED_OUT", message: "Sign in to vote." };
  }

  // Closed polls reject server-side. The client hides the option rows, but that
  // is presentation — this is the control.
  const { data: poll } = await supabase
    .from("polls")
    .select("id, status, expires_at, space_id")
    .eq("id", pollId)
    .maybeSingle();

  if (!poll || poll.status !== "live") {
    return { ok: false, code: "CLOSED", message: "This poll is closed." };
  }
  if (poll.expires_at && new Date(poll.expires_at).getTime() <= Date.now()) {
    return { ok: false, code: "CLOSED", message: "Voting has closed on this poll." };
  }

  // Voting auto-joins the Space — 03-ux-flows B: "Voting auto-joins. No separate
  // join step after the sheet." Ignore a conflict; already a member is fine.
  if (poll.space_id) {
    await supabase
      .from("space_members")
      .insert({ space_id: poll.space_id, user_id: user.id });
  }

  const { error } = await supabase.rpc("cast_vote", {
    p_poll: pollId,
    p_option: optionId,
    p_device: deviceId,
    p_user: user.id,
  });

  if (error) {
    if (error.message?.includes("ALREADY_VOTED")) {
      return { ok: false, code: "ALREADY_VOTED", message: "You've already voted here." };
    }
    return { ok: false, code: "ERROR", message: "Couldn't save your vote. Try again." };
  }

  revalidatePath(`/p/${slug}`);
  return { ok: true };
}

/** Join a Space without voting — the sheet's secondary path. */
export async function joinSpace(spaceId: string, slug: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  await supabase.from("space_members").insert({ space_id: spaceId, user_id: user.id });
  revalidatePath(`/p/${slug}`);
  return { ok: true };
}
