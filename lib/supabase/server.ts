import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server client for Server Components, Server Actions and Route Handlers that
 * need to know who the user is. **RLS applies** — this carries the user's
 * session, so the database enforces what they may see.
 *
 * Do NOT use this in the edge-cached routes (`/api/poll/*​/board`, `/og/*`).
 * Reading cookies opts the response out of the CDN — DECISIONS A2. Those use
 * `anon.ts` instead.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Components cannot set cookies. Harmless: proxy.ts refreshes
            // the session on every request, so the write here is redundant.
          }
        },
      },
    }
  );
}

/** The signed-in user's profile, or null. `null` also means "not onboarded". */
export async function getProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // dob is deliberately never selected — it gates 18+ at write time and is
  // never displayed. Selecting it here would leak it into every page payload.
  const { data } = await supabase
    .from("profiles")
    .select("id, handle, display_name, bio, instagram, x_handle, snapchat")
    .eq("id", user.id)
    .maybeSingle();

  return data;
}

/** The auth user only — cheaper than getProfile when you just need an id. */
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
