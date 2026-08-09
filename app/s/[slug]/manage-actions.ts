"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type SpaceManageState = { error?: string };

/**
 * Deleting a Space, by its creator.
 *
 * The whole rule lives in `delete_space()`, which is `security definer` and
 * takes identity from `auth.uid()`. Nothing here is a guard — a Server Action is
 * a public HTTP endpoint, so a check in this file would only be a nicer error
 * message. What it *does* do is turn the database's exception into a sentence.
 */
const MESSAGES: Record<string, string> = {
  NOT_OWNER: "That isn't your Space.",
  SIGNED_OUT: "You're signed out. Sign in again.",
  NO_SPACE: "That Space no longer exists.",
  HAS_OTHERS_POLLS:
    "Other people have posted polls here, so this Space can't be deleted. Their boards aren't yours to remove.",
};

export async function deleteSpace(
  _prev: SpaceManageState,
  form: FormData
): Promise<SpaceManageState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_space", {
    p_space: String(form.get("space_id") ?? ""),
  });

  if (error) {
    const hit = Object.keys(MESSAGES).find((k) => error.message?.includes(k));
    return { error: hit ? MESSAGES[hit] : "Couldn't delete that. Try again." };
  }

  // Nothing to revalidate back to — the Space and its polls are gone.
  redirect("/spaces?deleted=1");
}
