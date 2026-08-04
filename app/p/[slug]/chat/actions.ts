"use server";

import { createClient } from "@/lib/supabase/server";

/** Stable per-poll pseudonym: the same person is always `owl4713` on one poll,
 *  and a different handle on another. Consistency inside a thread is what makes
 *  anonymous chat readable; reusing it across polls would deanonymise them. */
function anonHandle(userId: string, pollId: string) {
  const animals = ["owl", "fox", "cat", "bee", "elk", "ram", "jay", "koi", "yak", "ant"];
  let h = 0;
  const seed = `${userId}:${pollId}`;
  for (let i = 0; i < seed.length; i++) h = (h * 33 + seed.charCodeAt(i)) >>> 0;
  return `${animals[h % animals.length]}${String(h % 10000).padStart(4, "0")}`;
}

export async function sendMessage(pollId: string, body: string, anon: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sign in to chat." };

  const text = body.trim().slice(0, 300);
  if (!text) return { ok: false, message: "Type something first." };

  const { error } = await supabase.from("messages").insert({
    poll_id: pollId,
    user_id: user.id,
    body: text,
    // The row still carries user_id even when anonymous — moderation and the
    // 3-report auto-hide need it. Anonymity is from other *users*, not from us,
    // and the API route never selects anon_handle alongside a name.
    anon_handle: anon ? anonHandle(user.id, pollId) : null,
  });

  if (error) return { ok: false, message: "Couldn't send. Try again." };
  return { ok: true, message: "" };
}
