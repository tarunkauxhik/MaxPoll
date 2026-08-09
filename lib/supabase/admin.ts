// This import is the whole point of the file's safety: `server-only` makes any
// client component that imports this a BUILD ERROR rather than a runtime leak of
// a key that bypasses Row Level Security entirely.
import "server-only";

import { createClient } from "@supabase/supabase-js";
import { requireEnv, supabaseUrl } from "@/lib/env";

/**
 * Secret-key client. **BYPASSES RLS COMPLETELY.**
 *
 * Only three things may use it:
 *   1. `/admin` — reading the order queue and granting access. There is
 *      deliberately no admin RLS policy, so this is the only path (RULES.md, admin).
 *   2. `verify_order()` — execute is revoked from every client role.
 *   3. Account deletion, which must null `user_id` on votes the user can't reach.
 *
 * Every call site must have already checked authorisation itself. This client
 * asks the database no permission questions, so it answers none.
 */
export const createAdminClient = () =>
  createClient(
    supabaseUrl(),
    // Read here, not in env.ts, so the literal never appears in a module the
    // client bundle can pull in.
    requireEnv("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
