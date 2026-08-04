"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type SpaceState = { error?: string };

export async function createSpace(_prev: SpaceState, form: FormData): Promise<SpaceState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in first." };

  const name = String(form.get("name") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();

  if (name.length < 3) return { error: "Give the Space a name people will recognise." };

  // Description is required on purpose — 03-ux-flows I: "thin descriptions are
  // how fakes get through". A one-word Space is indistinguishable from a squat.
  if (description.length < 15) {
    return { error: "Describe the Space in a sentence — it's how people tell real ones from fakes." };
  }

  const slug = `${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30)}-${Math.random().toString(36).slice(2, 6)}`;

  const { data, error } = await supabase
    .from("spaces")
    .insert({ slug, name, description, created_by: user.id })
    .select("id, slug")
    .single();

  if (error || !data) return { error: "Couldn't create the Space. Try again." };

  // The creator is its first member; the trigger keeps member_count honest.
  await supabase.from("space_members").insert({ space_id: data.id, user_id: user.id });

  redirect(`/s/${data.slug}`);
}

export async function toggleMembership(spaceId: string, slug: string, join: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  if (join) {
    await supabase.from("space_members").insert({ space_id: spaceId, user_id: user.id });
  } else {
    await supabase
      .from("space_members")
      .delete()
      .eq("space_id", spaceId)
      .eq("user_id", user.id);
  }
  return { ok: true, slug };
}
