"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanSocial, BIO_MAX } from "@/lib/profile";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export type DeleteState = { error?: string };

export type ProfileEditState = { error?: string; field?: string; ok?: string };

/**
 * Only the 5 columns migration 20260808200000 re-opened — handle/dob/id/
 * created_at are not in the grant, so this action doesn't offer them either.
 * The database is still the real guard (D2b/D2e): this validation is the
 * nicer error message, not the control.
 */
export async function updateProfile(
  _prev: ProfileEditState,
  form: FormData
): Promise<ProfileEditState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You're signed out. Sign in again." };

  const displayName = String(form.get("display_name") ?? "").trim();
  const bio = String(form.get("bio") ?? "").trim();

  if (displayName.length < 2 || displayName.length > 40) {
    return { field: "display_name", error: "Your name needs 2–40 characters." };
  }
  if (bio.length > BIO_MAX) {
    return { field: "bio", error: `Bio is ${bio.length} characters. Max is ${BIO_MAX}.` };
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      bio: bio || null,
      instagram: cleanSocial(String(form.get("instagram") ?? "")),
      x_handle: cleanSocial(String(form.get("x_handle") ?? "")),
      snapchat: cleanSocial(String(form.get("snapchat") ?? "")),
    })
    .eq("id", user.id)
    .select("handle")
    .maybeSingle();

  if (error) return { error: "Couldn't save your profile. Try again." };

  revalidatePath("/settings");
  if (data?.handle) revalidatePath(`/u/${data.handle}`);
  return { ok: "Saved." };
}

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
