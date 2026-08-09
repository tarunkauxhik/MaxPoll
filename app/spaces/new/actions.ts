"use server";

import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/slug";
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
  const next = String(form.get("next") ?? "");

  if (name.length < 3) return { error: "Give the Space a name people will recognise." };

  // Description is required on purpose — RULES.md: "thin descriptions are
  // how fakes get through". A one-word Space is indistinguishable from a squat.
  if (description.length < 15) {
    return { error: "Describe the Space in a sentence — it's how people tell real ones from fakes." };
  }

  const slug = slugify(name, 30, 4);

  // Through the RPC, not a direct insert. A direct insert let the client choose
  // `is_verified` — the tick that RULES.md calls the mark of a real
  // institution — and had no limit on how many Spaces one account could create.
  // The function forces is_verified false, caps it at 3 a week, and joins the
  // creator as first member in the same transaction.
  const { error } = await supabase.rpc("create_space", {
    p_slug: slug,
    p_name: name,
    p_description: description,
  });

  if (error) {
    if (error.message?.includes("WEEKLY_LIMIT")) {
      return { error: "You've created 3 Spaces this week. The limit resets 7 days after the first." };
    }
    return { error: "Couldn't create the Space. Try again." };
  }

  // Somebody sent here from `/create` wanted a poll, not a Space — put them back
  // on the form they abandoned, with the new Space now in the picker. Same
  // same-origin check as app/onboarding/actions.ts: a bare leading `/` is not
  // enough, since `//evil.com` is a protocol-relative URL to somewhere else.
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : `/s/${slug}`);
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
