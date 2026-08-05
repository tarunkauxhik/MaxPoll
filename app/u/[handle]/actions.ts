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

    // The `new_follower` row is written by a trigger on `follows`, not here.
    // Writing it from the client meant the client could write *any* activity row
    // to *any* feed — including invented notifications in someone else's bell.
  } else {
    await supabase
      .from("follows")
      .delete()
      .eq("follower_id", user.id)
      .eq("following_id", targetId);
  }

  return { ok: true };
}
