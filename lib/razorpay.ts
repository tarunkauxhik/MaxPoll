// Same reasoning as lib/supabase/admin.ts: `server-only` turns any client
// component that imports this into a BUILD ERROR rather than a runtime leak of
// the key secret, which is the whole of the payment signature scheme.
import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { clean, requireEnv } from "@/lib/env";
import { razorpayKeyId } from "@/lib/payments";

/**
 * Razorpay, over `fetch` and `node:crypto`.
 *
 * No SDK: the whole integration is one authenticated POST and two HMACs, and
 * `razorpay` pulls in a request stack we would otherwise not ship. Nothing here
 * needs a client object.
 *
 * The trust model, because it is the only thing in this file that matters:
 * **the browser is never believed.** Checkout hands the payer's device a payment
 * id and a signature; that signature is HMAC-SHA256 over `order_id|payment_id`
 * keyed with the secret, so only Razorpay and this server can produce one. An
 * unsigned "I paid" from a client is worth nothing and is never acted on.
 */

const keySecret = () => requireEnv("RAZORPAY_KEY_SECRET", process.env.RAZORPAY_KEY_SECRET);

/** Constant-time, and never throws on a length mismatch the way `timingSafeEqual` does. */
function hmacMatches(payload: string, secret: string, given: string): boolean {
  const want = Buffer.from(createHmac("sha256", secret).update(payload).digest("hex"));
  const got = Buffer.from((given ?? "").trim());
  return want.length === got.length && timingSafeEqual(want, got);
}

export type RazorpayOrder = { id: string; amount: number; status: string };

/**
 * Create the order on Razorpay's side.
 *
 * The amount is passed from `orders.amount_paise`, which is a generated column —
 * so the figure the payer is charged traces back to `kind` in the database and
 * not to anything a client sent. Checkout will only accept a payment for the
 * amount attached to the order id, which is what makes this the real price
 * check.
 *
 * `receipt` is our own `ref`, so a Razorpay dashboard row can be matched back to
 * a MaxPoll order by eye.
 */
export async function createRazorpayOrder(
  ref: string,
  amountPaise: number,
  notes: Record<string, string>
): Promise<RazorpayOrder> {
  const auth = Buffer.from(`${razorpayKeyId()}:${keySecret()}`).toString("base64");

  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Basic ${auth}` },
    body: JSON.stringify({
      amount: amountPaise,
      currency: "INR",
      receipt: ref,
      // Razorpay rejects a payment for more than the order amount but allows
      // partial ones unless this is set. A half-paid unlock is not an unlock.
      payment_capture: 1,
      notes,
    }),
  });

  if (!res.ok) {
    // Razorpay's error body names the field it disliked; the status alone does
    // not, and this is the call that fails on a bad key or a wrong amount.
    throw new Error(`Razorpay order failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

/**
 * The checkout callback's signature: HMAC over `order_id|payment_id`.
 * Razorpay's own docs spell the separator as a literal `|` — not a JSON blob,
 * not the notes, just those two ids.
 */
export const verifyPaymentSignature = (
  razorpayOrderId: string,
  razorpayPaymentId: string,
  signature: string
) => hmacMatches(`${razorpayOrderId}|${razorpayPaymentId}`, keySecret(), signature);

/**
 * The webhook's signature: HMAC over the **raw request body**, keyed with the
 * webhook secret — a different secret from the key secret, and re-parsing the
 * body before hashing it would change the bytes and fail every time.
 *
 * Returns false when the secret is unset. That is deliberate: an unconfigured
 * webhook must reject, not wave everything through, because this endpoint grants
 * paid access and its whole authentication is this one comparison.
 */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = clean("RAZORPAY_WEBHOOK_SECRET", process.env.RAZORPAY_WEBHOOK_SECRET);
  if (!secret || !signature) return false;
  return hmacMatches(rawBody, secret, signature);
}
