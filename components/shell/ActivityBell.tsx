import { createClient } from "@/lib/supabase/server";

/**
 * The bell sits in the top bar on every signed-in screen. B7 left a
 * slot for it in `TopBar`; this fills it.
 *
 * There is no web push on iOS, so this badge is the retention surface — 03-ux
 * §H. Count only, capped: "99+" is enough to pull a tap, and an exact 4,213
 * would just be noise.
 */
export async function ActivityBell() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { count } = await supabase
    .from("activity")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("read", false);

  const unread = count ?? 0;

  return (
    <a
      className="bell"
      href="/activity"
      aria-label={unread > 0 ? `Activity, ${unread} unread` : "Activity"}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 3a5.5 5.5 0 0 0-5.5 5.5c0 3-1 4.5-2 5.5h15c-1-1-2-2.5-2-5.5A5.5 5.5 0 0 0 12 3Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path d="M10 18a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
      {unread > 0 && <span className="dot num">{unread > 99 ? "99+" : unread}</span>}
    </a>
  );
}
