"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export type DeleteState = { error?: string };

/**
 * Account deletion — required under DPDP.
 *
 * **Votes are anonymised, not deleted.** `votes.user_id` is nulled so poll
 * counts don't retroactively change: deleting the rows would silently rewrite
 * every board the person ever voted on, which is both wrong for other users and
 * a worse privacy outcome than it looks (the gap is itself information).
 * The confirm copy says this explicitly.
 *
 * Needs the admin client: nulling `user_id` on votes the user can no longer
 * reach is exactly the sort of write RLS is meant to refuse.
 */
export async function deleteAccount(_prev: DeleteState, form: FormData): Promise<DeleteState> {
  const typed = String(form.get("confirm") ?? "").trim().toLowerCase().replace(/^@/, "");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You're signed out." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("handle")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return { error: "No profile found." };
  if (typed !== profile.handle) {
    return { error: `Type @${profile.handle} exactly to confirm.` };
  }

  const admin = createAdminClient();

  await admin.from("votes").update({ user_id: null }).eq("user_id", user.id);
  await admin.from("messages").update({ user_id: null }).eq("user_id", user.id);

  // profiles.id references auth.users on delete cascade, so removing the auth
  // user takes the profile, memberships, activity and entitlements with it —
  // the votes above have already been detached.
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return { error: "Couldn't delete the account. Try again." };

  await supabase.auth.signOut();
  redirect("/?deleted=1");
}
