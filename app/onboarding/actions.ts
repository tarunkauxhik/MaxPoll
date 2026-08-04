"use server";

import { createClient } from "@/lib/supabase/server";
import { isAdult, isValidHandle, cleanSocial, BIO_MAX } from "@/lib/profile";
import { redirect } from "next/navigation";

export type OnboardingState = { error?: string; field?: string };

export async function completeOnboarding(
  _prev: OnboardingState,
  form: FormData
): Promise<OnboardingState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You're signed out. Sign in again to continue." };

  const handle = String(form.get("handle") ?? "").trim().toLowerCase();
  const displayName = String(form.get("display_name") ?? "").trim();
  const dob = String(form.get("dob") ?? "").trim();
  const bio = String(form.get("bio") ?? "").trim();
  const next = String(form.get("next") ?? "/");

  if (!isValidHandle(handle)) {
    return { field: "handle", error: "3–20 characters, lowercase letters, numbers and _ only." };
  }
  if (displayName.length < 2 || displayName.length > 40) {
    return { field: "display_name", error: "Your name needs 2–40 characters." };
  }
  if (bio.length > BIO_MAX) {
    return { field: "bio", error: `Bio is ${bio.length} characters. Max is ${BIO_MAX}.` };
  }

  // The 18+ gate. Checked server-side because the client one is a convenience,
  // not a control — docs/03-ux-flows.md, and it is a hard stop, never a soft gate.
  if (!isAdult(dob)) {
    if (dob && /^\d{4}-\d{2}-\d{2}$/.test(dob)) redirect("/onboarding/under-18");
    return { field: "dob", error: "Enter your date of birth." };
  }

  const { error } = await supabase.from("profiles").insert({
    id: user.id,
    handle,
    display_name: displayName,
    dob,
    bio: bio || null,
    instagram: cleanSocial(String(form.get("instagram") ?? "")),
    x_handle: cleanSocial(String(form.get("x_handle") ?? "")),
    snapchat: cleanSocial(String(form.get("snapchat") ?? "")),
  });

  if (error) {
    // 23505 = unique_violation. The only unique column a user picks is `handle`.
    if (error.code === "23505") {
      return { field: "handle", error: `@${handle} is taken. Try another.` };
    }
    return { error: "Couldn't save your profile. Try again." };
  }

  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}
