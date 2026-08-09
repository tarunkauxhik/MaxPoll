import { createClient } from "@supabase/supabase-js";
import { supabaseKey, supabaseUrl } from "@/lib/env";

/**
 * Cookie-free client for the **edge-cached** routes only:
 * `/api/poll/[id]/board`, `/api/poll/[id]/messages`, `/og/[slug]`.
 *
 * RULES.md, caching: the single most dangerous item in this project. Vercel's CDN
 * refuses to cache ANY response carrying `Set-Cookie`. `@supabase/ssr` sets auth
 * cookies on every response it touches, so routing the board through the session
 * client makes `s-maxage=4` decorative: every viewer invokes a function, and the
 * whole "viewer count is irrelevant to your bill" thesis collapses — silently,
 * with no error anywhere.
 *
 * So this client reads no cookies and writes none. It is anonymous by
 * construction, which is correct: the board contains no per-user data. Voter
 * names are gated by RLS and never appear in it.
 *
 * The other half of the fix is `proxy.ts` excluding these paths from its matcher.
 * Both halves are required.
 */
export const createAnonClient = () =>
  createClient(
    supabaseUrl(),
    supabaseKey(),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
