/**
 * Run a .sql file against the remote database.
 *
 *   pnpm sql supabase/seed.sql
 *   pnpm sql --wipe            (removes all seed data)
 *
 * The Supabase CLI can only apply *migrations*, and seed data must never be a
 * migration — it would auto-apply on every `db push` and ship demo content to
 * production. Hence this.
 *
 * Dev-only (`pg` is a devDependency). Nothing in the app imports it.
 */
import { readFileSync } from "node:fs";
import pg from "pg";
import { need } from "./env.mjs";

const WIPE = `
delete from votes    where device_id = 'seed-device';
delete from options  where added_by  in (select id from profiles where handle like 'seed_%');
delete from polls    where created_by in (select id from profiles where handle like 'seed_%');
delete from spaces   where slug like 'seed-%';
delete from profiles where handle like 'seed_%';
delete from auth.users where email like 'seed+%@maxpoll.test';
`;

const arg = process.argv[2];
if (!arg) {
  console.error("usage: pnpm sql <file.sql> | pnpm sql --wipe");
  process.exit(1);
}

const sql = arg === "--wipe" ? WIPE : readFileSync(arg, "utf8");

const client = new pg.Client({
  connectionString: need("SUPABASE_DB_URL"),
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  await client.query(sql);
  console.log(arg === "--wipe" ? "seed data removed" : `applied ${arg}`);
} catch (err) {
  console.error("SQL ERROR:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
