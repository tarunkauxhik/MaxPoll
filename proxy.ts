import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Session refresh.
 *
 * ⚠️ THIS FILE IS `proxy.ts`, NOT `middleware.ts`.
 * Next 16 renamed Middleware to Proxy. Supabase's SSR quickstart still says
 * `middleware.ts`, and Next 16 does not invoke that filename — no error, no
 * warning, sessions simply never refresh. See docs/LEARNINGS.md.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do not remove. Without this call the session is never refreshed and users
  // are logged out at random when the access token expires.
  await supabase.auth.getUser();

  return response;
}

/**
 * ⚠️ DECISIONS A2 — the exclusions below are load-bearing, not an optimisation.
 *
 * This proxy sets auth cookies on every response it touches, and **Vercel's CDN
 * refuses to cache any response carrying `Set-Cookie`**. Route the board through
 * here and `s-maxage=4` becomes decorative: every single viewer invokes a
 * function. It fails silently — the page still works, the bill just scales with
 * traffic, and nothing anywhere reports an error.
 *
 * Excluded because they are edge-cached:
 *   api/poll/*​/board · api/poll/*​/messages · og/*
 *
 * NOT excluded, and must stay that way: `/admin` and `/pay/*` need cookies to
 * know who you are, and neither is cacheable.
 *
 * Gate 5 asserts `x-vercel-cache: HIT`. That is the only real proof this works.
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/poll/.*/board|api/poll/.*/messages|og/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)",
  ],
};
