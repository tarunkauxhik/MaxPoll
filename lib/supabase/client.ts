import { createBrowserClient } from "@supabase/ssr";
import { supabaseKey, supabaseUrl } from "@/lib/env";

/** Browser client. Publishable key, RLS applies. Safe to ship — it's designed to be public. */
export const createClient = () => createBrowserClient(supabaseUrl(), supabaseKey());
