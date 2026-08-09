// node --test lib/payments.test.ts   (part of `pnpm check`)
// No test framework: Node 24 runs TypeScript directly and ships node:test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { paymentMode, isValidUtr, isAdmin, upiIntentUrl, rupees } from "./payments.ts";

const withEnv = (vars: Record<string, string | undefined>, fn: () => void) => {
  const prev = { ...process.env };
  Object.assign(process.env, vars);
  try { fn(); } finally { process.env = prev; }
};

test("paymentMode fails closed", () => {
  const closed = { NEXT_PUBLIC_UPI_VPA: "maxpoll@ybl" };
  for (const raw of [undefined, "", "test", "live", "MANUAL_UPI", "razorpay"]) {
    withEnv({ ...closed, NEXT_PUBLIC_PAYMENTS_MODE: raw }, () =>
      assert.equal(paymentMode(), "coming_soon", `mode ${JSON.stringify(raw)}`)
    );
  }
});

test("manual_upi without a VPA degrades to coming_soon", () => {
  withEnv({ NEXT_PUBLIC_PAYMENTS_MODE: "manual_upi", NEXT_PUBLIC_UPI_VPA: "" }, () =>
    assert.equal(paymentMode(), "coming_soon")
  );
  withEnv({ NEXT_PUBLIC_PAYMENTS_MODE: "manual_upi", NEXT_PUBLIC_UPI_VPA: "maxpoll@ybl" }, () =>
    assert.equal(paymentMode(), "manual_upi")
  );
});

test("a razorpay mode needs a key id from the same environment", () => {
  const cases: [string, string | undefined, string][] = [
    // mode                  key id                  expected
    ["razorpay_test", undefined, "coming_soon"],
    ["razorpay_test", "", "coming_soon"],
    ["razorpay_test", "rzp_test_TLhSxuj7oJouKS", "razorpay_test"],
    ["razorpay_live", "rzp_live_abc123", "razorpay_live"],
    // The pairing that costs money: test keys under a live switch takes real
    // intent to a sandbox, and live keys under a test switch charges real cards
    // from a staging branch.
    ["razorpay_live", "rzp_test_TLhSxuj7oJouKS", "coming_soon"],
    ["razorpay_test", "rzp_live_abc123", "coming_soon"],
    // Same paste bug as the UPI one — quotes must not silently kill the rail.
    ["razorpay_test", '"rzp_test_TLhSxuj7oJouKS"', "razorpay_test"],
  ];

  for (const [mode, key, expected] of cases) {
    withEnv(
      { NEXT_PUBLIC_PAYMENTS_MODE: mode, NEXT_PUBLIC_RAZORPAY_KEY_ID: key },
      () => assert.equal(paymentMode(), expected, `${mode} + ${JSON.stringify(key)}`)
    );
  }
});

test("isAdmin: empty allowlist means nobody", () => {
  const uid = "0f3accf9-033f-4560-83e3-5cf8ad87c695";
  withEnv({ ADMIN_USER_IDS: undefined }, () => assert.equal(isAdmin(uid), false));
  withEnv({ ADMIN_USER_IDS: "" }, () => assert.equal(isAdmin(uid), false));
  withEnv({ ADMIN_USER_IDS: "  ,  " }, () => assert.equal(isAdmin(uid), false));
  // an empty allowlist must not match an empty/absent user id either
  withEnv({ ADMIN_USER_IDS: "" }, () => assert.equal(isAdmin(""), false));
  withEnv({ ADMIN_USER_IDS: `other, ${uid} ` }, () => assert.equal(isAdmin(uid), true));
  withEnv({ ADMIN_USER_IDS: `${uid}x` }, () => assert.equal(isAdmin(uid), false));
});

test("isValidUtr wants exactly 12 digits", () => {
  assert.equal(isValidUtr("402318774521"), true);
  assert.equal(isValidUtr(" 402318774521 "), true);
  assert.equal(isValidUtr("40231877452"), false);
  assert.equal(isValidUtr("4023187745211"), false);
  assert.equal(isValidUtr("40231877452a"), false);
  assert.equal(isValidUtr(""), false);
});

test("upiIntentUrl encodes to the NPCI spec", () => {
  withEnv({ NEXT_PUBLIC_UPI_VPA: "maxpoll@ybl", NEXT_PUBLIC_UPI_PAYEE_NAME: "MaxPoll" }, () => {
    const url = upiIntentUrl("MP7K3QD2", 900);
    const q = new URLSearchParams(url.slice("upi://pay?".length));
    assert.equal(q.get("pa"), "maxpoll@ybl");
    assert.equal(q.get("am"), "9.00");        // two decimals, always
    assert.equal(q.get("cu"), "INR");
    assert.equal(q.get("tr"), "MP7K3QD2");    // the ref rides `tr`, not `tn`
    assert.equal(rupees(9900), "99");
  });
  withEnv({ NEXT_PUBLIC_UPI_VPA: "" }, () => assert.throws(() => upiIntentUrl("MP1", 900)));
});

test("a quoted env value does not silently disable payments", () => {
  // The 2026-08-05 paste bug: quotes round a Vercel value. Here it would have
  // failed closed in silence, which is indistinguishable from "not launched yet".
  withEnv({ NEXT_PUBLIC_PAYMENTS_MODE: '"manual_upi"', NEXT_PUBLIC_UPI_VPA: "'maxpoll@ybl'" }, () => {
    assert.equal(paymentMode(), "manual_upi");
    assert.match(upiIntentUrl("MP123456", 900), /pa=maxpoll%40ybl/);
  });
  withEnv({ ADMIN_USER_IDS: '"a-uuid, b-uuid"' }, () => assert.equal(isAdmin("b-uuid"), true));
});

test("the intent URI is readable by a strict RFC 3986 parser", () => {
  withEnv({ NEXT_PUBLIC_UPI_VPA: "tarunkaushikraya@oksbi" }, () => {
    const url = upiIntentUrl("MP4F2A1B", 900);
    // `+` here would render as a literal plus in the payer's note field.
    assert.ok(!url.includes("+"), `plus survived encoding: ${url}`);
    assert.match(url, /tn=MaxPoll%20MP4F2A1B/);
    assert.match(url, /pa=tarunkaushikraya%40oksbi/);
    // The amount is a hint the payer can edit; the reference is what we match on.
    assert.match(url, /am=9\.00/);
    assert.match(url, /tr=MP4F2A1B/);
  });
});
