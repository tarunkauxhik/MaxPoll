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

test("razorpay modes stay closed until the rail is built", () => {
  for (const m of ["razorpay_test", "razorpay_live"]) {
    withEnv({ NEXT_PUBLIC_PAYMENTS_MODE: m }, () => assert.equal(paymentMode(), "coming_soon"));
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
