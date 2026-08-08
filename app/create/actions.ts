"use server";

import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/slug";
import { redirect } from "next/navigation";

export type CreateState = { error?: string };

export async function createPoll(_prev: CreateState, form: FormData): Promise<CreateState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to create a poll." };

  const subjectType = String(form.get("subject_type") ?? "thing");
  // Free-text now (DECISIONS D10) — a <select> used to trim and cap this for
  // free, so an <input> needs to do it explicitly.
  const adjective = String(form.get("adjective") ?? "").trim().slice(0, 40);
  const scope = String(form.get("scope") ?? "").trim();
  const freeTitle = String(form.get("title") ?? "").trim();
  const spaceId = String(form.get("space_id") ?? "").trim();
  const expiresRaw = String(form.get("expires_at") ?? "").trim();
  const expires = expiresRaw && expiresRaw !== "none" ? expiresRaw : null;

  const title = subjectType === "person" ? `${adjective} ${scope}`.trim() : freeTitle;
  if (title.length < 4) return { error: "Give the poll a title people will recognise." };

  const options = (form.getAll("options") as string[])
    .map((o) => o.trim())
    .filter(Boolean);
  if (options.length < 2) return { error: "Add at least 2 starting options." };
  if (options.length > 10) return { error: "10 starting options maximum." };

  // create_poll() enforces the 3-per-week limit inside the transaction, so two
  // rapid submits can't both slip past a check-then-insert race.
  const { data, error } = await supabase.rpc("create_poll", {
    p_slug: slugify(title),
    p_space: spaceId || null,
    p_title: title,
    p_subject_type: subjectType,
    p_category: subjectType === "person" ? "people" : "things",
    p_expires: expires,
    p_options: options,
  });

  if (error) {
    if (error.message?.includes("WEEKLY_LIMIT")) {
      return { error: "You've created 3 polls this week. The limit resets 7 days after your first." };
    }
    if (error.message?.includes("EXPIRY_TOO_FAR")) return { error: "A poll can run for 7 days at most." };
    if (error.message?.includes("EXPIRY_IN_PAST")) return { error: "Pick a deadline in the future." };
    if (error.message?.includes("TOO_FEW_OPTIONS")) return { error: "Add at least 2 options." };
    if (error.message?.includes("TOO_MANY_OPTIONS")) return { error: "10 options maximum." };
    return { error: "Couldn't create the poll. Try again." };
  }

  const { data: poll } = await supabase.from("polls").select("slug").eq("id", data).single();
  redirect(`/p/${poll!.slug}?created=1`);
}

/** How many of this week's 3 are left — shown as "2 of 3 left this week". */
export async function pollsLeftThisWeek(userId: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("polls")
    .select("id", { count: "exact", head: true })
    .eq("created_by", userId)
    .gte("created_at", new Date(Date.now() - 7 * 24 * 3600e3).toISOString());
  return Math.max(0, 3 - (count ?? 0));
}
