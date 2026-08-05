/**
 * Put a Space and its opening polls live, from a JSON file.
 *
 *   node scripts/launch.mjs supabase/launch.json            # dry run — writes nothing
 *   node scripts/launch.mjs supabase/launch.json --apply
 *
 * **Why this exists.** docs/01-product.md Week 0 is "seed 1 Space + 20-30 polls",
 * and `create_poll()` caps every account at 3 polls a week. That cap is an
 * anti-spam control enforced inside the transaction, so it does not move and gets
 * no admin bypass — admin identity lives in an env var, not the database, and
 * putting it in the database purely so the operator can skip a rule would trade a
 * real boundary for convenience. This goes through the same door supabase/seed.sql
 * uses instead: direct SQL as the table owner, over SUPABASE_DB_URL.
 *
 * It writes **no votes**. "8-10 real friend-votes before posting publicly" means
 * real friends. Inventing them is the seed data we deliberately wiped off a public
 * voting product.
 *
 * Dev-only — `pg` is a devDependency and nothing in the app imports this.
 */
import { readFileSync } from "node:fs";
import pg from "pg";
import { need } from "./env.mjs";
import { slugify } from "../lib/slug.ts";

const [file, ...flags] = process.argv.slice(2);
const apply = flags.includes("--apply");

if (!file) {
  console.error("usage: node scripts/launch.mjs <file.json> [--apply]");
  process.exit(1);
}

// ── parse and validate before opening a connection ────────────────────────────

const plan = JSON.parse(readFileSync(file, "utf8"));
const problems = [];

const str = (v) => (typeof v === "string" ? v.trim() : "");

/**
 * "Rajma Sir" and "rajma sir!" are one option, not two — same normalisation as
 * the generated `options.label_norm` column. There is no unique index behind it,
 * so a duplicate here would silently become two rows splitting the same votes.
 * First spelling wins.
 */
const dedupe = (labels) => {
  const seen = new Set();
  return labels.filter((l) => {
    const norm = l.toLowerCase().replace(/[^a-z0-9 ]/g, "");
    return seen.has(norm) ? false : (seen.add(norm), true);
  });
};

if (!str(plan.owner_handle)) problems.push("owner_handle is required");
if (!str(plan.space?.name)) problems.push("space.name is required");
// Same 15-char floor the UI enforces (app/spaces/new/actions.ts) — 03-ux-flows I,
// "thin descriptions are how fakes get through".
if (str(plan.space?.description).length < 15) {
  problems.push("space.description must be at least 15 characters");
}
if (!Array.isArray(plan.polls) || plan.polls.length === 0) {
  problems.push("polls must be a non-empty array");
}

const polls = (Array.isArray(plan.polls) ? plan.polls : []).map((p, i) => {
  const where = `polls[${i}]`;
  const title = str(p.title);
  const subject = str(p.subject_type) || "thing";
  // create_poll() truncates option labels to 80 and drops anything under 2 chars,
  // because options_label_len rejects the rest. Same rules here, so a launch poll
  // cannot contain an option the product would have refused.
  const options = dedupe(
    (Array.isArray(p.options) ? p.options : [])
      .map((o) => str(o).slice(0, 80))
      .filter((o) => o.length >= 2)
  );

  if (title.length < 4) problems.push(`${where}.title is too short`);
  if (!["person", "thing"].includes(subject)) {
    problems.push(`${where}.subject_type must be "person" or "thing"`);
  }
  if (options.length < 2) problems.push(`${where} needs at least 2 usable options`);

  const hours = Number(p.closes_in_hours ?? 0);
  if (p.closes_in_hours != null && !(hours > 0)) {
    problems.push(`${where}.closes_in_hours must be a positive number, or omitted`);
  }

  return {
    title,
    subject,
    options,
    hours: hours > 0 ? hours : null,
    slug: slugify(title, 40, 5),
    category: subject === "person" ? "people" : "things",
  };
});

const dupes = polls
  .map((p) => p.title.toLowerCase())
  .filter((t, i, all) => all.indexOf(t) !== i);
if (dupes.length) problems.push(`duplicate titles: ${[...new Set(dupes)].join(", ")}`);

if (problems.length) {
  console.error(`\n${file} has ${problems.length} problem(s):\n`);
  for (const p of problems) console.error(`  · ${p}`);
  process.exit(1);
}

const space = {
  name: str(plan.space.name),
  description: str(plan.space.description),
  slug: slugify(str(plan.space.name), 30, 4),
};

// ── show the plan ─────────────────────────────────────────────────────────────

console.log(`\nSpace   ${space.name}   /s/${space.slug}`);
console.log(`Owner   @${str(plan.owner_handle)}`);
console.log(`Polls   ${polls.length}\n`);
for (const p of polls) {
  const when = p.hours ? `closes in ${p.hours}h` : "no timer";
  console.log(`  ${p.title}`);
  console.log(`    /p/${p.slug} · ${p.options.length} options · ${when}`);
}

// ── write ─────────────────────────────────────────────────────────────────────

const client = new pg.Client({
  connectionString: need("SUPABASE_DB_URL"),
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  const { rows: owners } = await client.query(
    "select id from profiles where handle = $1",
    [str(plan.owner_handle)]
  );
  if (owners.length === 0) {
    throw new Error(
      `no profile with handle "${str(plan.owner_handle)}" — sign in once so the profile exists`
    );
  }
  const owner = owners[0].id;

  const { rows: clash } = await client.query(
    "select slug from spaces where lower(name) = lower($1)",
    [space.name]
  );
  if (clash.length) {
    throw new Error(`a Space named "${space.name}" already exists at /s/${clash[0].slug}`);
  }

  if (!apply) {
    // Deliberately after the two checks above: a handle typo or a name clash is
    // what you want to hear about while you are still reading the preview.
    console.log(`\nDry run — nothing written. Re-run with --apply.\n`);
  } else {
    await write(client, { owner, space, polls });
    console.log(`\nLive: /s/${space.slug} — ${polls.length} polls\n`);
  }
} catch (err) {
  await client.query("rollback").catch(() => {});
  console.error(`\nLAUNCH FAILED: ${err.message}\n`);
  process.exitCode = 1;
} finally {
  await client.end();
}

/** One transaction: a bad row must not leave a half-built Space behind. */
async function write(client, { owner, space, polls }) {
  await client.query("begin");

  const { rows: made } = await client.query(
    `insert into spaces (slug, name, description, created_by)
     values ($1, $2, $3, $4) returning id`,
    [space.slug, space.name, space.description, owner]
  );
  const spaceId = made[0].id;

  // create_poll() joins the creator to the Space; a direct insert has to as well,
  // or the owner cannot post through the UI afterwards. The trigger on
  // space_members keeps spaces.member_count honest — don't set it here.
  await client.query(
    "insert into space_members (space_id, user_id) values ($1, $2) on conflict do nothing",
    [spaceId, owner]
  );

  for (const p of polls) {
    const { rows: poll } = await client.query(
      `insert into polls (slug, space_id, created_by, title, subject_type, category, expires_at)
       values ($1, $2, $3, $4, $5, $6, $7) returning id`,
      [
        p.slug,
        spaceId,
        owner,
        p.title,
        p.subject,
        p.category,
        p.hours ? new Date(Date.now() + p.hours * 3600e3).toISOString() : null,
      ]
    );

    // unnest, so option order survives and polls.option_count is bumped once per
    // row by the existing trigger.
    await client.query(
      `insert into options (poll_id, label, added_by)
       select $1, label, $2 from unnest($3::text[]) as label`,
      [poll[0].id, owner, p.options]
    );
  }

  await client.query("commit");
}
