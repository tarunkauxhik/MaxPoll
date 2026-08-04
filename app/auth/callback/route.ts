import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Google returns here. Exchanges the code for a session, then routes to
 * onboarding if there's no profile yet.
 *
 * `next` carries the poll the user came from, so the vote-intent replay lands
 * back on the right page — Phase 4.4, the highest-damage bug in the product.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  // Only ever redirect within our own origin. An open redirect here would let a
  // phishing link borrow our domain on the way out.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/?error=auth`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/?error=auth`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user!.id)
    .maybeSingle();

  if (!profile) {
    const to = new URL(`${origin}/onboarding`);
    if (safeNext !== "/") to.searchParams.set("next", safeNext);
    return NextResponse.redirect(to);
  }

  return NextResponse.redirect(`${origin}${safeNext}`);
}
