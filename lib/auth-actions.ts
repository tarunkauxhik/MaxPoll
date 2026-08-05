"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { clean } from "@/lib/env";

/**
 * Sign in AND sign up. Deliberately one function.
 *
 * Google returns the account if it exists and creates it if not, so "Log in" and
 * "Sign up" are the same button pointing at the same handler. There are no
 * passwords anywhere in this product, therefore no forgot/reset flow exists or
 * should ever be built — docs/03-ux-flows.md.
 */
export async function signInWithGoogle(next?: string) {
  const supabase = await createClient();
  // `??` was wrong twice over: an empty value in Vercel produced `new URL("/auth/…")`,
  // and a whole `.env.local` pasted into Vercel leaves the localhost value here,
  // which bounces every production sign-in to the developer's machine. The request
  // host is always correct on Vercel, so prefer it whenever the var looks local.
  const configured = clean("NEXT_PUBLIC_SITE_URL", process.env.NEXT_PUBLIC_SITE_URL);
  const usable = configured && !(process.env.VERCEL && configured.includes("localhost"));
  const origin = usable ? configured : `https://${(await headers()).get("host")}`;

  const callback = new URL(`${origin}/auth/callback`);
  if (next) callback.searchParams.set("next", next);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callback.toString() },
  });

  if (error || !data.url) redirect("/?error=auth");
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
