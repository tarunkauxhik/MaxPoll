// node --test lib/supabase/env.test.mts   (part of `pnpm check`)
import { test } from "node:test";
import assert from "node:assert/strict";
import { clean, requireEnv, supabaseUrl } from "./env.ts";

const withEnv = (vars: Record<string, string | undefined>, fn: () => void) => {
  const prev = { ...process.env };
  Object.assign(process.env, vars);
  try { fn(); } finally { process.env = prev; }
};

test("clean undoes what a dashboard paste leaves behind", () => {
  const name = "NEXT_PUBLIC_SUPABASE_URL";
  const url = "https://abc.supabase.co";
  for (const raw of [
    url,
    `  ${url}  `,
    `"${url}"`,
    `'${url}'`,
    `${name}=${url}`,
    ` ${name}="${url}" `,
    `${url}\n`,
  ]) {
    assert.equal(clean(name, raw), url, `failed on ${JSON.stringify(raw)}`);
  }
  assert.equal(clean(name, undefined), "");
  // A lone quote is a value, not a wrapper — don't eat it.
  assert.equal(clean(name, '"'), '"');
});

test("requireEnv names the variable and never echoes the value", () => {
  assert.throws(
    () => requireEnv("SUPABASE_SECRET_KEY", "  "),
    (e: Error) => e.message.includes("SUPABASE_SECRET_KEY") && !e.message.includes("hunter2")
  );
  assert.equal(requireEnv("SUPABASE_SECRET_KEY", '"hunter2"'), "hunter2");
});

test("supabaseUrl rejects exactly what took production down", () => {
  // The live failure: set, non-empty, no scheme. supabase-js answered with
  // `Invalid supabaseUrl` and named nothing.
  for (const bad of ["abc.supabase.co", "postgresql://db/x", "NEXT_PUBLIC_SUPABASE_URL"]) {
    withEnv({ NEXT_PUBLIC_SUPABASE_URL: bad }, () =>
      assert.throws(supabaseUrl, (e: Error) =>
        e.message.includes("NEXT_PUBLIC_SUPABASE_URL") && e.message.includes(bad)
      )
    );
  }
  withEnv({ NEXT_PUBLIC_SUPABASE_URL: "" }, () =>
    assert.throws(supabaseUrl, /empty or missing/)
  );
  withEnv({ NEXT_PUBLIC_SUPABASE_URL: '"https://abc.supabase.co"' }, () =>
    assert.equal(supabaseUrl(), "https://abc.supabase.co")
  );
});
