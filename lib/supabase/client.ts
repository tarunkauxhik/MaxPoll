import { createBrowserClient } from "@supabase/ssr";

/** Browser client. Publishable key, RLS applies. Safe to ship — it's designed to be public. */
export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
