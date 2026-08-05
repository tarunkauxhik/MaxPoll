/**
 * `.env.local` as an object, for the dev scripts.
 *
 * Not `--env-file`: `sql.mjs`, `gates.mjs` and `launch.mjs` are run through pnpm
 * scripts and one plain `node`, and this keeps all three reading the same file
 * the same way. The app never imports it — Next loads `.env.local` itself.
 */
import { readFileSync } from "node:fs";

export const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

/** Names the missing variable instead of failing later with `undefined`. */
export function need(name) {
  const v = env[name];
  if (!v) {
    console.error(`${name} is missing from .env.local`);
    process.exit(1);
  }
  return v;
}
