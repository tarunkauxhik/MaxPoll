/**
 * The one place the Supabase connection variables are read.
 *
 * 2026-08-05: production returned 500 on every route with
 *   `Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL.`
 * supabase-js throws that only when the value is **non-empty and does not start
 * with http(s)** — an unset variable gives `supabaseUrl is required.` instead.
 * So the variable was set in Vercel, with a broken value, and the error named
 * neither the variable nor what it actually contained.
 *
 * Two jobs here: undo what pasting into a dashboard field leaves behind, and
 * fail with a message that says which variable and what was in it.
 *
 * ⚠️ The `process.env.X` reads must stay in the *caller*, spelled out in full.
 * Next inlines `process.env.NEXT_PUBLIC_*` textually at build time; a dynamic
 * lookup (`process.env[name]`) is never substituted and is `undefined` in the
 * browser. Hence the awkward two-argument signature.
 */

/** Strips a copied `NAME=` prefix, surrounding quotes, and whitespace. */
export function clean(name: string, raw: string | undefined): string {
  let v = (raw ?? "").trim();
  if (v.startsWith(`${name}=`)) v = v.slice(name.length + 1).trim();
  const q = v[0];
  if (v.length > 1 && (q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1).trim();
  return v;
}

const REDEPLOY =
  "Set it in Vercel → Settings → Environment Variables (Production), then " +
  "**redeploy** — NEXT_PUBLIC_* values are baked into the build, so editing " +
  "them alone changes nothing.";

/** Never echoes the value: this is also used for secrets. */
export function requireEnv(name: string, raw: string | undefined): string {
  const v = clean(name, raw);
  if (!v) throw new Error(`${name} is empty or missing. ${REDEPLOY}`);
  return v;
}

export function supabaseUrl(): string {
  const v = requireEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  // Safe to print — it is a NEXT_PUBLIC_ value and ships to every browser anyway.
  if (!/^https?:\/\//i.test(v))
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL must start with https:// — got ${JSON.stringify(v)}. ` +
        `Copy "Project URL" from Supabase → Project Settings → Data API. ${REDEPLOY}`
    );
  return v;
}

export const supabaseKey = (): string =>
  requireEnv(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
