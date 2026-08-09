"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type VoteResult =
  | { ok: true }
  | {
      ok: false;
      code: "SIGNED_OUT" | "ALREADY_VOTED" | "CLOSED" | "NO_VOTE" | "ERROR";
      message: string;
    };

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

  // Voting auto-joins the Space — RULES.md: "Voting auto-joins. No separate
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
    // Ignored whenever there's a session — the function reads auth.uid() and only
    // falls back to this for the seed and admin scripts, which have no session.
    // It used to be authoritative, which let anyone vote as anyone.
    p_user: user.id,
  });

  if (error) {
    if (error.message?.includes("ALREADY_VOTED")) {
      return { ok: false, code: "ALREADY_VOTED", message: "You've already voted here." };
    }
    // The poll can expire between the check above and this call.
    if (error.message?.includes("CLOSED")) {
      return { ok: false, code: "CLOSED", message: "Voting has closed on this poll." };
    }
    return { ok: false, code: "ERROR", message: "Couldn't save your vote. Try again." };
  }

  revalidatePath(`/p/${slug}`);
  return { ok: true };
}

/**
 * Move an existing vote to a different option.
 *
 * Separate from `castVote` because it is a different database operation, not a
 * different code path to the same one: `votes_poll_user_uniq` allows exactly one
 * row per person per poll, so this UPDATEs that row and shifts the two option
 * counters. `polls.vote_count` deliberately does not move — it is still one
 * vote, and counting a change as a new one would inflate every total on the
 * site.
 *
 * No ownership argument: `change_vote()` reads `auth.uid()`. Passing a user id
 * into a `security definer` function is what let anyone vote as anyone once —
 * RULES.md, security.
 */
export async function changeVote(
  pollId: string,
  optionId: string,
  slug: string
): Promise<VoteResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, code: "SIGNED_OUT", message: "Sign in to vote." };

  const { error } = await supabase.rpc("change_vote", {
    p_poll: pollId,
    p_option: optionId,
  });

  if (error) {
    if (error.message?.includes("CLOSED")) {
      return { ok: false, code: "CLOSED", message: "Voting has closed on this poll." };
    }
    if (error.message?.includes("NO_VOTE")) {
      // They have no vote to move. The caller falls back to casting one.
      return { ok: false, code: "NO_VOTE", message: "You haven't voted here yet." };
    }
    return { ok: false, code: "ERROR", message: "Couldn't change your vote. Try again." };
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
