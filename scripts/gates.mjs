/**
 * Gate probes 3 / 4 / 6 / P, run against the REAL Supabase project.
 *
 *   pnpm gates
 *
 * Everything it creates, it deletes. Nothing here touches the browser — see
 * docs/STATE.md for the checks only a human can do (FLIP, x-vercel-cache, the
 * Google round trip, 360px density).
 *
 * The point of running against the real database rather than mocks: the Gate 2
 * version of this script found an actual RLS hole that reasoning had missed.
 */
import { env } from "./env.mjs";

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const PUB = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SEC = env.SUPABASE_SECRET_KEY;

const fails = [];
const ok = (cond, msg) => {
  console.log(`${cond ? "  PASS" : "  FAIL"}  ${msg}`);
  if (!cond) fails.push(msg);
};
const head = (s) => console.log(`\n── ${s} ${"─".repeat(Math.max(0, 58 - s.length))}`);

/** `token` = a user's access token (RLS applies as that user), else a raw key. */
const api = async (path, key, opts = {}, token) => {
  const r = await fetch(`${URL_}${path}`, {
    ...opts,
    headers: {
      apikey: key,
      Authorization: `Bearer ${token ?? key}`,
      "Content-Type": "application/json",
      ...opts.headers,
    },
  });
  const text = await r.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: r.status, body };
};

const ins = (t, row, key = SEC) =>
  api(`/rest/v1/${t}`, key, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(row),
  });

/**
 * Creates a confirmed user and returns { id, token }. The token is what makes
 * these probes worth running: without it every check runs as anonymous, and
 * "user can't see X" passes for the wrong reason.
 *
 * Password grant is unavailable — the Email provider is disabled, which is the
 * point (Gate 3). But the *admin* API can still mint a magic link, and verifying
 * it returns a real session in the redirect fragment. Admin-only, secret-key
 * only, so this is a test affordance and not a hole.
 */
async function makeUser(tag) {
  const email = `gate.${tag}.${Date.now()}@maxpoll.test`;

  const created = await api("/auth/v1/admin/users", SEC, {
    method: "POST",
    body: JSON.stringify({ email, email_confirm: true }),
  });
  const id = created.body?.id;
  if (!id) throw new Error(`could not create user: ${JSON.stringify(created.body)}`);

  const link = await api("/auth/v1/admin/generate_link", SEC, {
    method: "POST",
    body: JSON.stringify({ type: "magiclink", email }),
  });

  let token = null;
  if (link.body?.hashed_token) {
    const verified = await fetch(
      `${URL_}/auth/v1/verify?type=magiclink&token=${link.body.hashed_token}&redirect_to=${URL_}`,
      { redirect: "manual", headers: { apikey: PUB } }
    );
    // GoTrue returns the session in the URL fragment of a 303.
    token =
      new URLSearchParams((verified.headers.get("location") ?? "").split("#")[1] ?? "").get(
        "access_token"
      ) ?? null;
  }

  await ins("profiles", {
    id,
    handle: `gate_${tag}_${Date.now().toString(36)}`.slice(0, 20),
    display_name: `Gate ${tag}`,
    dob: "2000-01-01",
  });

  return { id, email, token };
}

const cleanup = { users: [], polls: [], spaces: [] };

async function teardown() {
  head("teardown");
  for (const p of cleanup.polls) await api(`/rest/v1/polls?id=eq.${p}`, SEC, { method: "DELETE" });
  for (const s of cleanup.spaces) await api(`/rest/v1/spaces?id=eq.${s}`, SEC, { method: "DELETE" });
  for (const u of cleanup.users) await api(`/auth/v1/admin/users/${u}`, SEC, { method: "DELETE" });

  const left = await api("/rest/v1/polls?select=id&slug=like.gate-*", SEC);
  ok(Array.isArray(left.body) && left.body.length === 0, "all probe data removed");
}

try {
  // ══════════════════════════════════════════════════ setup
  const alice = await makeUser("a");
  const bob = await makeUser("b");
  cleanup.users.push(alice.id, bob.id);
  ok(!!alice.token && !!bob.token, "two signed-in test users with real sessions");

  // Hard stop, not a soft fail. Without tokens every "as a signed-in user" check
  // below silently runs as anonymous, and several of them PASS for the wrong
  // reason — which is worse than not running them at all.
  if (!alice.token || !bob.token) {
    throw new Error("no session tokens — the RLS-as-user probes would be meaningless");
  }

  const space = await ins("spaces", {
    slug: `gate-space-${Date.now()}`,
    name: "Gate Space",
    description: "Probe space for the gate scripts.",
    created_by: alice.id,
  });
  const spaceId = space.body?.[0]?.id;
  cleanup.spaces.push(spaceId);

  const poll = await ins("polls", {
    slug: `gate-poll-${Date.now()}`,
    space_id: spaceId,
    created_by: alice.id,
    title: "Gate probe poll",
    subject_type: "thing",
    category: "things",
  });
  const pollId = poll.body?.[0]?.id;
  const pollSlug = poll.body?.[0]?.slug;
  cleanup.polls.push(pollId);

  const optA = (await ins("options", { poll_id: pollId, label: "Rajma Sir", added_by: alice.id }))
    .body?.[0]?.id;
  const optB = (await ins("options", { poll_id: pollId, label: "Verma Maam", added_by: alice.id }))
    .body?.[0]?.id;

  // ══════════════════════════════════════════════════ GATE 3 — auth & RLS as a user
  head("Gate 3 — auth boundaries");

  const signup = await api("/auth/v1/signup", PUB, {
    method: "POST",
    body: JSON.stringify({ email: "probe@gmail.com", password: "whatever123" }),
  });
  ok(
    signup.status >= 400 && !signup.body?.id,
    `public password signup refused (${signup.status} ${signup.body?.error_code ?? ""})`
  );

  const counts = await api(`/rest/v1/polls?select=option_count&id=eq.${pollId}`, SEC);
  ok(counts.body?.[0]?.option_count === 2, `option_count trigger fires (got ${counts.body?.[0]?.option_count})`);

  const mem = await api(`/rest/v1/spaces?select=member_count&id=eq.${spaceId}`, SEC);
  ok(mem.body?.[0]?.member_count === 0, "member_count starts at 0");

  // ══════════════════════════════════════════════════ GATE 4 — the critical path
  head("Gate 4 — voting");

  const vote1 = await api("/rest/v1/rpc/cast_vote", PUB, {
    method: "POST",
    body: JSON.stringify({ p_poll: pollId, p_option: optA, p_device: "gate-device", p_user: alice.id }),
  }, alice.token);
  ok(vote1.status < 300, `alice votes (${vote1.status})`);

  const vote2 = await api("/rest/v1/rpc/cast_vote", PUB, {
    method: "POST",
    body: JSON.stringify({ p_poll: pollId, p_option: optB, p_device: "gate-device", p_user: alice.id }),
  }, alice.token);
  ok(
    vote2.status >= 400 && JSON.stringify(vote2.body).includes("ALREADY_VOTED"),
    "second vote from the same account → ALREADY_VOTED"
  );

  // DECISIONS A4 — the shared-laptop case. device_id is a signal, not a constraint.
  const vote3 = await api("/rest/v1/rpc/cast_vote", PUB, {
    method: "POST",
    body: JSON.stringify({ p_poll: pollId, p_option: optB, p_device: "gate-device", p_user: bob.id }),
  }, bob.token);
  ok(vote3.status < 300, `different account, SAME device → vote lands (${vote3.status})`);

  const after = await api(`/rest/v1/polls?select=vote_count&id=eq.${pollId}`, SEC);
  const rows = await api(`/rest/v1/votes?select=id&poll_id=eq.${pollId}`, SEC);
  ok(
    after.body?.[0]?.vote_count === rows.body?.length,
    `polls.vote_count (${after.body?.[0]?.vote_count}) === actual rows (${rows.body?.length})`
  );

  const optCounts = await api(`/rest/v1/options?select=id,vote_count&poll_id=eq.${pollId}`, SEC);
  const sum = (optCounts.body ?? []).reduce((s, o) => s + (o.vote_count ?? 0), 0);
  ok(sum === rows.body?.length, `sum(options.vote_count) (${sum}) === actual rows (${rows.body?.length})`);

  // ══════════════════════════════════════════════════ GATE 2 (regression) — names
  head("Gate 2 — voter names stay server-side");

  const anonVotes = await api(`/rest/v1/votes?select=*&poll_id=eq.${pollId}`, PUB);
  ok(Array.isArray(anonVotes.body) && anonVotes.body.length === 0, "anon reads votes → []");

  // The differential: an empty array from a dead key would pass the line above.
  const anonOpts = await api(`/rest/v1/options?select=id&poll_id=eq.${pollId}`, PUB);
  ok(anonOpts.body?.length === 2, "…but anon still reads options (so the key works)");

  // A signed-in user with no entitlement sees their OWN vote and nobody else's.
  const bobSees = await api(`/rest/v1/votes?select=user_id&poll_id=eq.${pollId}`, PUB, {}, bob.token);
  ok(
    bobSees.body?.length === 1 && bobSees.body[0].user_id === bob.id,
    `unentitled user sees only their own vote (${bobSees.body?.length} row/s)`
  );

  await ins("entitlements", {
    user_id: bob.id,
    poll_id: pollId,
    kind: "poll_unlock",
    source: "comp",
  });
  const bobEntitled = await api(`/rest/v1/votes?select=user_id&poll_id=eq.${pollId}`, PUB, {}, bob.token);
  ok(bobEntitled.body?.length === 2, `entitled user sees every vote (${bobEntitled.body?.length})`);

  // ══════════════════════════════════════════════════ GATE 6 — typeahead & merge
  head("Gate 6 — options & moderation");

  const search = await api("/rest/v1/rpc/search_options", PUB, {
    method: "POST",
    body: JSON.stringify({ p_poll: pollId, p_query: "rajma" }),
  });
  ok(
    Array.isArray(search.body) && search.body[0]?.label === "Rajma Sir" && "rank" in (search.body[0] ?? {}),
    `typeahead returns the match with its rank (${JSON.stringify(search.body?.[0] ?? {})})`
  );

  const before = (await api(`/rest/v1/votes?select=id&poll_id=eq.${pollId}`, SEC)).body.length;
  const merge = await api("/rest/v1/rpc/merge_options", PUB, {
    method: "POST",
    body: JSON.stringify({ p_from: optB, p_into: optA }),
  }, alice.token);
  ok(merge.status < 300, `owner merges two options (${merge.status})`);

  const afterMerge = (await api(`/rest/v1/votes?select=id&poll_id=eq.${pollId}`, SEC)).body.length;
  ok(before === afterMerge, `merge loses no votes (${before} → ${afterMerge})`);

  const merged = await api(`/rest/v1/options?select=id,vote_count,hidden,merged_into&poll_id=eq.${pollId}`, SEC);
  const target = merged.body.find((o) => o.id === optA);
  const source = merged.body.find((o) => o.id === optB);
  ok(target?.vote_count === before, `counts summed onto the survivor (${target?.vote_count})`);
  ok(source?.hidden === true && source?.merged_into === optA, "merged option hidden and linked");

  const notOwner = await api("/rest/v1/rpc/merge_options", PUB, {
    method: "POST",
    body: JSON.stringify({ p_from: optA, p_into: optB }),
  }, bob.token);
  ok(notOwner.status >= 400, `non-owner cannot merge (${notOwner.status})`);

  // ══════════════════════════════════════════════════ GATE W — write guards
  //
  // Everything here asks the same question: is the rule in the DATABASE, or only
  // in a Server Action a client can walk around? Each probe is the request our
  // own code never makes.
  //
  // ⚠️ The 403s below must be 403, not 401. A 401 means the session was lost and
  // the probe is testing nothing — the trap that made two checks pass for the
  // wrong reason before.
  head("Gate W — write guards");

  const wPoll = await ins("polls", {
    slug: `gate-write-${Date.now()}`,
    created_by: alice.id,
    title: "Write guard poll",
    subject_type: "thing",
    category: "things",
  });
  const wPollId = wPoll.body?.[0]?.id;
  cleanup.polls.push(wPollId);
  const wOpt = (await ins("options", { poll_id: wPollId, label: "Guard option", added_by: alice.id }))
    .body?.[0]?.id;

  // --- the vote path: identity came from a parameter, not the session ---------
  const spoof = await api("/rest/v1/rpc/cast_vote", PUB, {
    method: "POST",
    body: JSON.stringify({
      p_poll: wPollId, p_option: wOpt, p_device: "spoof-device", p_user: bob.id,
    }),
  }, alice.token);
  const spoofRow = await api(`/rest/v1/votes?select=user_id&poll_id=eq.${wPollId}`, SEC);
  ok(
    spoof.status < 300 && spoofRow.body?.[0]?.user_id === alice.id,
    `cast_vote ignores p_user and uses the session (stored ${spoofRow.body?.[0]?.user_id === alice.id ? "alice" : "BOB — SPOOF WORKS"})`
  );

  const rawVote = await api("/rest/v1/votes", PUB, {
    method: "POST",
    body: JSON.stringify({ poll_id: wPollId, option_id: wOpt, device_id: "raw", user_id: bob.id }),
  }, bob.token);
  ok(rawVote.status === 403, `direct INSERT into votes refused (${rawVote.status})`);

  const badOpt = await api("/rest/v1/rpc/cast_vote", PUB, {
    method: "POST",
    body: JSON.stringify({ p_poll: wPollId, p_option: optA, p_device: "d", p_user: bob.id }),
  }, bob.token);
  ok(
    badOpt.status >= 400 && JSON.stringify(badOpt.body).includes("BAD_OPTION"),
    "an option from another poll is refused"
  );

  // --- chat -------------------------------------------------------------------
  const rawMsg = await api("/rest/v1/messages", PUB, {
    method: "POST",
    body: JSON.stringify({ poll_id: wPollId, user_id: alice.id, body: "x".repeat(5000) }),
  }, alice.token);
  ok(rawMsg.status === 403, `direct INSERT into messages refused (${rawMsg.status})`);

  await api("/rest/v1/rpc/send_message", PUB, {
    method: "POST",
    body: JSON.stringify({ p_poll: wPollId, p_body: "y".repeat(5000), p_anon: false }),
  }, alice.token);
  const stored = await api(`/rest/v1/messages?select=body&poll_id=eq.${wPollId}`, SEC);
  ok(
    stored.body?.[0]?.body?.length === 300,
    `a 5000-char body is stored at 300 (${stored.body?.[0]?.body?.length})`
  );

  let limited = 0;
  for (let i = 0; i < 12; i++) {
    const r = await api("/rest/v1/rpc/send_message", PUB, {
      method: "POST",
      body: JSON.stringify({ p_poll: wPollId, p_body: `flood ${i}`, p_anon: true }),
    }, bob.token);
    if (r.status >= 400 && JSON.stringify(r.body).includes("RATE_LIMITED")) limited++;
  }
  ok(limited >= 2, `chat flood is rate limited (${limited} of 12 refused)`);

  const anonHandles = await api(
    `/rest/v1/messages?select=anon_handle,user_id&poll_id=eq.${wPollId}&anon_handle=not.is.null`, SEC);
  const handles = new Set((anonHandles.body ?? []).map((m) => m.anon_handle));
  ok(handles.size === 1, `one person gets one pseudonym per poll (${handles.size} distinct)`);

  // --- add option -------------------------------------------------------------
  const rawOpt = await api("/rest/v1/options", PUB, {
    method: "POST",
    body: JSON.stringify({ poll_id: wPollId, label: "Snuck in", added_by: bob.id }),
  }, bob.token);
  ok(rawOpt.status === 403, `direct INSERT into options refused (${rawOpt.status})`);

  await api(`/rest/v1/polls?id=eq.${wPollId}`, SEC, {
    method: "PATCH",
    body: JSON.stringify({ options_locked: true }),
  });
  const lockedAdd = await api("/rest/v1/rpc/add_option", PUB, {
    method: "POST",
    body: JSON.stringify({ p_poll: wPollId, p_label: "Too late" }),
  }, bob.token);
  ok(
    lockedAdd.status >= 400 && JSON.stringify(lockedAdd.body).includes("LOCKED"),
    "a locked poll refuses new options"
  );

  await api(`/rest/v1/polls?id=eq.${wPollId}`, SEC, {
    method: "PATCH",
    body: JSON.stringify({ options_locked: false, status: "closed" }),
  });
  const closedAdd = await api("/rest/v1/rpc/add_option", PUB, {
    method: "POST",
    body: JSON.stringify({ p_poll: wPollId, p_label: "Also too late" }),
  }, bob.token);
  ok(
    closedAdd.status >= 400 && JSON.stringify(closedAdd.body).includes("CLOSED"),
    "a closed poll refuses new options"
  );

  // ══════════════════════════════════════════════════ GATE C — column guards
  //
  // RLS picks rows; these check the columns. Every one of these succeeded against
  // the live database before the 20260806110000 migration.
  //
  // ⚠️ Each refusal is confirmed by READING THE VALUE BACK with the secret key,
  // never by trusting the status. PostgREST answers 403 to an insert sent with
  // `Prefer: return=representation` when only the *read-back* was denied — the
  // row still lands. A probe that believes the status reports "safe" while the
  // write sits in the table. That is how the activity hole nearly got missed.
  head("Gate C — column guards");

  const cPoll = await ins("polls", {
    slug: `gate-col-${Date.now()}`,
    space_id: spaceId,
    created_by: alice.id,
    title: "Column guard poll",
    subject_type: "thing",
    category: "things",
  });
  const cPollId = cPoll.body?.[0]?.id;
  cleanup.polls.push(cPollId);
  const cOpt = (await ins("options", { poll_id: cPollId, label: "Honest count", added_by: alice.id }))
    .body?.[0]?.id;
  const cHidden = (await ins("options", { poll_id: cPollId, label: "Moderated away", added_by: alice.id, hidden: true }))
    .body?.[0]?.id;

  const patch = (path, body, token) =>
    api(path, PUB, { method: "PATCH", body: JSON.stringify(body) }, token);

  const p1 = await patch(`/rest/v1/polls?id=eq.${cPollId}`, { vote_count: 99999 }, alice.token);
  const p1Row = await api(`/rest/v1/polls?id=eq.${cPollId}&select=vote_count`, SEC);
  ok(
    p1.status === 403 && p1Row.body?.[0]?.vote_count === 0,
    `creator cannot fabricate polls.vote_count (${p1.status}, still ${p1Row.body?.[0]?.vote_count})`
  );

  const p2 = await patch(`/rest/v1/options?id=eq.${cOpt}`, { vote_count: 4242 }, alice.token);
  const p2Row = await api(`/rest/v1/options?id=eq.${cOpt}&select=vote_count`, SEC);
  ok(
    p2.status === 403 && p2Row.body?.[0]?.vote_count === 0,
    `creator cannot fabricate options.vote_count (${p2.status}, still ${p2Row.body?.[0]?.vote_count})`
  );

  const p3 = await patch(`/rest/v1/options?id=eq.${cHidden}`, { hidden: false }, alice.token);
  const p3Row = await api(`/rest/v1/options?id=eq.${cHidden}&select=hidden`, SEC);
  ok(
    p3.status === 403 && p3Row.body?.[0]?.hidden === true,
    `creator cannot un-hide a moderated option (${p3.status}, still hidden=${p3Row.body?.[0]?.hidden})`
  );

  const directPoll = await api("/rest/v1/polls", PUB, {
    method: "POST",
    body: JSON.stringify({
      slug: `gate-direct-${Date.now()}`, created_by: alice.id,
      title: "Past create_poll", subject_type: "thing", category: "things",
    }),
  }, alice.token);
  const directRow = await api("/rest/v1/polls?select=id&slug=like.gate-direct-*", SEC);
  ok(
    directPoll.status === 403 && directRow.body?.length === 0,
    `the 3-per-week limit cannot be walked around by inserting a poll (${directPoll.status})`
  );

  const fakeTick = await api("/rest/v1/spaces", PUB, {
    method: "POST",
    body: JSON.stringify({
      slug: `gate-tick-${Date.now()}`, name: "Totally Real University",
      description: "Self-awarded tick.", created_by: alice.id, is_verified: true,
    }),
  }, alice.token);
  const tickRow = await api("/rest/v1/spaces?select=id&slug=like.gate-tick-*", SEC);
  ok(
    fakeTick.status === 403 && tickRow.body?.length === 0,
    `nobody can award themselves the verified tick (${fakeTick.status})`
  );

  const madeSpace = await api("/rest/v1/rpc/create_space", PUB, {
    method: "POST",
    body: JSON.stringify({
      p_slug: `gate-space-rpc-${Date.now()}`, p_name: "Gate RPC Space",
      p_description: "A description long enough to clear the check.",
    }),
  }, alice.token);
  const madeRow = await api(`/rest/v1/spaces?id=eq.${madeSpace.body}&select=is_verified,member_count`, SEC);
  if (madeSpace.body) cleanup.spaces.push(madeSpace.body);
  ok(
    madeRow.body?.[0]?.is_verified === false && madeRow.body?.[0]?.member_count === 1,
    `create_space() forces is_verified false and joins the creator (${JSON.stringify(madeRow.body?.[0])})`
  );

  const ownProfile = await patch(`/rest/v1/profiles?id=eq.${alice.id}`, { display_name: "Renamed" }, alice.token);
  const profRow = await api(`/rest/v1/profiles?id=eq.${alice.id}&select=display_name`, SEC);
  ok(
    ownProfile.status === 403 && profRow.body?.[0]?.display_name !== "Renamed",
    `profiles is insert-once — no edit path exists yet (${ownProfile.status})`
  );

  // No `Prefer: return=representation`: with it, a denied read-back masquerades as
  // a denied write, and this exact check would pass while the row landed.
  const poison = await api("/rest/v1/activity", PUB, {
    method: "POST",
    body: JSON.stringify({ user_id: bob.id, type: "same_as_you", payload: { poll_title: "Tap to claim ₹500" } }),
  }, alice.token);
  const bobFeed = await api(`/rest/v1/activity?select=payload&user_id=eq.${bob.id}&type=eq.same_as_you`, SEC);
  const poisoned = JSON.stringify(bobFeed.body ?? []).includes("claim");
  ok(
    poison.status === 403 && !poisoned,
    `nobody can write a notification into someone else's feed (${poison.status}, poisoned=${poisoned})`
  );

  const markRead = await patch(`/rest/v1/activity?user_id=eq.${alice.id}`, { read: true }, alice.token);
  ok(markRead.status < 300, `…but you can still mark your own notifications read (${markRead.status})`);

  const bumpOther = await patch(`/rest/v1/activity?user_id=eq.${alice.id}`, { type: "badge_earned" }, alice.token);
  ok(bumpOther.status === 403, `and only the read column (${bumpOther.status})`);

  // The feed's whole reason to exist.
  const cOptId = cOpt;
  await api("/rest/v1/rpc/cast_vote", PUB, {
    method: "POST",
    body: JSON.stringify({ p_poll: cPollId, p_option: cOptId, p_device: "gate-c", p_user: alice.id }),
  }, alice.token);
  await api("/rest/v1/rpc/cast_vote", PUB, {
    method: "POST",
    body: JSON.stringify({ p_poll: cPollId, p_option: cOptId, p_device: "gate-c", p_user: bob.id }),
  }, bob.token);
  const sameRows = await api(
    `/rest/v1/activity?select=user_id&type=eq.same_as_you&payload->>poll_id=eq.${cPollId}`, SEC);
  ok(sameRows.body?.length === 2, `both voters get a same_as_you row (${sameRows.body?.length})`);

  const names = await api("/rest/v1/rpc/same_as_you_names", PUB, {
    method: "POST", body: JSON.stringify({ p_polls: [cPollId] }),
  }, alice.token);
  ok(
    names.body?.[0]?.total === 1 && (names.body?.[0]?.names ?? []).length <= 2,
    `same_as_you_names caps at 2 and counts the rest (${JSON.stringify(names.body?.[0])})`
  );

  // The one that would turn the paywall into a public name directory.
  const stranger = await makeUser("s");
  cleanup.users.push(stranger.id);
  const leak = await api("/rest/v1/rpc/same_as_you_names", PUB, {
    method: "POST", body: JSON.stringify({ p_polls: [cPollId] }),
  }, stranger.token);
  ok(
    Array.isArray(leak.body) && leak.body.length === 0,
    `a user who never voted learns no names (${JSON.stringify(leak.body)})`
  );

  // ══════════════════════════════════════════════════ GATE X — polls that end
  //
  // `polls.status` never left 'live' on its own. isExpired() made the poll page
  // look right, which is exactly why this went unnoticed: the read path was
  // correct and the data was not.
  head("Gate X — closing expired polls");

  const mkPoll = async (slug, expiresAt) =>
    (await ins("polls", {
      slug: `gate-${slug}-${Date.now()}`,
      created_by: alice.id,
      title: `Closing probe ${slug}`,
      subject_type: "thing",
      category: "things",
      expires_at: expiresAt,
    })).body?.[0];

  // `past` starts with time on the clock and is backdated below. cast_vote
  // refuses an already-expired poll — correctly — so voting has to happen while
  // it is live, which is also how it happens in life.
  const past = await mkPoll("past", new Date(Date.now() + 3600_000).toISOString());
  const future = await mkPoll("future", new Date(Date.now() + 3600_000).toISOString());
  const endless = await mkPoll("endless", null);
  for (const p of [past, future, endless]) cleanup.polls.push(p.id);

  // Two options so there is a real winner, and the loser is created first —
  // so a wrong sort order (created_at before vote_count) names the wrong one.
  const loser = (await ins("options", { poll_id: past.id, label: "Runner up", added_by: alice.id })).body?.[0];
  const winner = (await ins("options", { poll_id: past.id, label: "The winner", added_by: alice.id })).body?.[0];
  for (const [u, opt] of [[alice, winner], [bob, winner]]) {
    await api("/rest/v1/rpc/cast_vote", PUB, {
      method: "POST",
      body: JSON.stringify({ p_poll: past.id, p_option: opt.id, p_device: "gate-x", p_user: u.id }),
    }, u.token);
  }
  // The loser needs a vote too, or "highest count" and "first created" agree.
  await api(`/rest/v1/options?id=eq.${loser.id}`, SEC, {
    method: "PATCH", body: JSON.stringify({ vote_count: 1 }),
  });

  // Now let the clock run out, the one part of "wait an hour" a probe may skip.
  await api(`/rest/v1/polls?id=eq.${past.id}`, SEC, {
    method: "PATCH",
    body: JSON.stringify({ expires_at: new Date(Date.now() - 3600_000).toISOString() }),
  });

  const closedCount = await api("/rest/v1/rpc/close_expired_polls", PUB, { method: "POST" });
  const states = await api(
    `/rest/v1/polls?select=id,status&id=in.(${[past.id, future.id, endless.id].join(",")})`, SEC);
  const statusOf = (id) => (states.body ?? []).find((p) => p.id === id)?.status;

  ok(statusOf(past.id) === "closed", `an expired poll closes (${statusOf(past.id)})`);
  ok(statusOf(future.id) === "live", `a poll with time left is untouched (${statusOf(future.id)})`);
  ok(statusOf(endless.id) === "live", `a poll with no expiry is never closed (${statusOf(endless.id)})`);
  ok(Number(closedCount.body) >= 1, `the RPC reports what it closed (${closedCount.body})`);

  const notes = await api(
    `/rest/v1/activity?select=user_id,payload&type=eq.poll_closed&payload->>poll_id=eq.${past.id}`, SEC);
  const voters = new Set((notes.body ?? []).map((r) => r.user_id));
  ok(
    voters.size === 2 && voters.has(alice.id) && voters.has(bob.id),
    `everyone who voted is notified, once each (${voters.size})`
  );
  ok(
    notes.body?.[0]?.payload?.winner === "The winner",
    `the notification names the board's rank-1 option (${notes.body?.[0]?.payload?.winner})`
  );

  // Idempotent: the cron runs daily and must not re-notify.
  await api("/rest/v1/rpc/close_expired_polls", PUB, { method: "POST" });
  const again = await api(
    `/rest/v1/activity?select=id&type=eq.poll_closed&payload->>poll_id=eq.${past.id}`, SEC);
  ok(again.body?.length === 2, `a second run writes nothing new (${again.body?.length})`);

  // ══════════════════════════════════════════════════ GATE P — payments
  head("Gate P — payment pipeline");

  const order = await ins("orders", { user_id: alice.id, poll_id: pollId, kind: "poll_unlock" });
  const orderId = order.body?.[0]?.id;
  ok(order.body?.[0]?.amount_paise === 900, `amount generated by the DB (${order.body?.[0]?.amount_paise})`);
  ok(/^MP[0-9A-F]{6}$/.test(order.body?.[0]?.ref ?? ""), `ref auto-generated (${order.body?.[0]?.ref})`);

  const badAmount = await ins("orders", {
    user_id: bob.id,
    poll_id: pollId,
    kind: "pass_30d",
    amount_paise: 1,
  });
  ok(badAmount.status >= 400, `client-supplied amount_paise rejected (${badAmount.status})`);

  const dupOpen = await ins("orders", { user_id: alice.id, poll_id: pollId, kind: "poll_unlock" });
  ok(dupOpen.status >= 400, `second open order for the same poll blocked (${dupOpen.status})`);

  // Column grants (DECISIONS D2b): RLS picks rows, not columns.
  const escalate = await api(`/rest/v1/orders?id=eq.${orderId}`, PUB, {
    method: "PATCH",
    body: JSON.stringify({ kind: "pass_30d" }),
  }, alice.token);
  ok(escalate.status >= 400, `payer cannot rewrite their order's kind (${escalate.status})`);

  const selfVerify = await api(`/rest/v1/orders?id=eq.${orderId}`, PUB, {
    method: "PATCH",
    body: JSON.stringify({ status: "verified" }),
  }, alice.token);
  const stillPending = await api(`/rest/v1/orders?select=status&id=eq.${orderId}`, SEC);
  ok(
    stillPending.body?.[0]?.status !== "verified",
    `payer cannot approve themselves (status is ${stillPending.body?.[0]?.status}, PATCH ${selfVerify.status})`
  );

  await api(`/rest/v1/orders?id=eq.${orderId}`, SEC, {
    method: "PATCH",
    body: JSON.stringify({ utr: "402318774521", status: "submitted", submitted_at: new Date().toISOString() }),
  });

  const rpcDenied = await api("/rest/v1/rpc/verify_order", PUB, {
    method: "POST",
    body: JSON.stringify({ p_order: orderId, p_admin: alice.id }),
  }, alice.token);
  ok(rpcDenied.status >= 400, `verify_order unreachable by a signed-in user (${rpcDenied.status})`);

  const verified = await api("/rest/v1/rpc/verify_order", SEC, {
    method: "POST",
    body: JSON.stringify({ p_order: orderId, p_admin: alice.id }),
  });
  ok(verified.status < 300, `service role verifies (${verified.status})`);

  const twice = await api("/rest/v1/rpc/verify_order", SEC, {
    method: "POST",
    body: JSON.stringify({ p_order: orderId, p_admin: alice.id }),
  });
  ok(
    twice.status >= 400 && JSON.stringify(twice.body).includes("NOT_PENDING"),
    "verifying twice raises NOT_PENDING"
  );

  const grants = await api(`/rest/v1/entitlements?select=id&user_id=eq.${alice.id}`, SEC);
  ok(grants.body?.length === 1, `exactly one entitlement written (${grants.body?.length})`);

  // A UTR unlocks once. Without this index one payer forwards the number to fifty friends.
  const reuse = await ins("orders", { user_id: bob.id, poll_id: null, kind: "pass_30d" });
  const reuseId = reuse.body?.[0]?.id;
  const reused = await api(`/rest/v1/orders?id=eq.${reuseId}`, SEC, {
    method: "PATCH",
    body: JSON.stringify({ utr: "402318774521", status: "submitted" }),
  });
  ok(reused.status >= 400, `a UTR cannot be reused on another order (${reused.status})`);

  const anonOrders = await api("/rest/v1/orders?select=*", PUB);
  ok(anonOrders.body?.length === 0, "anon reads no orders");
  const bobOrders = await api("/rest/v1/orders?select=id,user_id", PUB, {}, bob.token);
  ok(
    (bobOrders.body ?? []).every((o) => o.user_id === bob.id),
    `a user sees only their own orders (${bobOrders.body?.length})`
  );

  console.log(`\n(poll for manual checks: /p/${pollSlug})`);
} catch (err) {
  console.error("\nPROBE ERROR:", err.message);
  fails.push(`threw: ${err.message}`);
} finally {
  await teardown();
}

console.log(fails.length ? `\n${fails.length} FAILURE(S)\n` : "\nALL GATES PASS\n");
process.exit(fails.length ? 1 : 0);
