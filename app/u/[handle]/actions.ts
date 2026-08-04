"use server";

import { createClient } from "@/lib/supabase/server";

export async function toggleFollow(targetId: string, follow: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id === targetId) return { ok: false };

  if (follow) {
    const { error } = await supabase
      .from("follows")
      .insert({ follower_id: user.id, following_id: targetId });
    if (error) return { ok: false };

    // Activity is written by the path that causes it — no cron (CLAUDE.md).
    await supabase.from("activity").insert({
      user_id: targetId,
      type: "new_follower",
      payload: { follower_id: user.id },
    });
  } else {
    await supabase
      .from("follows")
      .delete()
      .eq("follower_id", user.id)
      .eq("following_id", targetId);
  }

  return { ok: true };
}
