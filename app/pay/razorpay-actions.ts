"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isRazorpay, paymentMode } from "@/lib/payments";
import { createRazorpayOrder, verifyPaymentSignature } from "@/lib/razorpay";
import { revalidatePath } from "next/cache";

/**
 * The Razorpay rail's two server steps. Manual UPI's equivalents live in
 * ./actions.ts; both start from the same `orders` row, which is why neither
 * creates one.
 *
 * A Server Action is a public HTTP endpoint (docs/RULES.md), so both functions
 * re-read the order under the caller's own session — RLS restricts `orders` to
 * `auth.uid() = user_id`, which is what actually stops someone paying against a
 * ref they guessed.
 */

export type CheckoutState = { error?: string; ok?: boolean };

/**
 * Get the Razorpay order id for one of our refs, creating it on the first ask.
 *
 * Reused rather than recreated, so reloading the pay page does not litter the
 * Razorpay dashboard with abandoned orders — and so the id in the browser always
 * matches the one the webhook will look up.
 *
 * The write goes through the secret-key client because `update on orders` is
 * revoked and re-granted column by column, and `razorpay_order_id` is
 * deliberately not in that grant: a client that could write it could point its
 * own order at somebody else's payment. Ownership is checked on the line above,
 * against the session client.
 */
export async function ensureRazorpayOrder(
  ref: string
): Promise<{ orderId: string } | { error: string }> {
  if (!isRazorpay(paymentMode())) return { error: "Card payments aren't switched on." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You're signed out. Sign in and try again." };

  const { data: order } = await supabase
    .from("orders")
    .select("id, ref, kind, poll_id, amount_paise, status, razorpay_order_id")
    .eq("ref", ref)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!order) return { error: "That order no longer exists." };
  if (order.status === "verified") return { error: "This one is already paid." };
  if (order.razorpay_order_id) return { orderId: order.razorpay_order_id };

  try {
    const rzp = await createRazorpayOrder(order.ref, order.amount_paise, {
      ref: order.ref,
      kind: order.kind,
      user_id: user.id,
      poll_id: order.poll_id ?? "",
    });

    await createAdminClient()
      .from("orders")
      .update({ razorpay_order_id: rzp.id })
      .eq("id", order.id);

    return { orderId: rzp.id };
  } catch (e) {
    // The message carries Razorpay's own body — useful in the Vercel log, not on
    // a payment screen.
    console.error("[razorpay] order create failed", e);
    return { error: "Couldn't reach the payment provider. Try again in a moment." };
  }
}

/**
 * The checkout callback. Everything here arrives from the payer's browser, so
 * the signature is the only part that is believed: it is an HMAC keyed with the
 * secret, which the browser does not have.
 *
 * The grant itself is `verify_razorpay_order()` — one transaction for the ledger
 * flip and the entitlement, and idempotent, because the webhook fires for this
 * same payment too and whichever lands first wins.
 */
export async function confirmRazorpayPayment(
  ref: string,
  razorpayOrderId: string,
  razorpayPaymentId: string,
  signature: string
): Promise<CheckoutState> {
  if (!verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, signature)) {
    console.error("[razorpay] bad signature", { ref, razorpayOrderId });
    return { error: "We couldn't verify that payment. Nothing has been unlocked — contact us with your payment id." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You're signed out. Sign in and try again." };

  // RLS scopes this to the caller's own orders, so a valid signature for
  // somebody else's order still finds nothing here.
  const { data: order } = await supabase
    .from("orders")
    .select("razorpay_order_id")
    .eq("ref", ref)
    .eq("user_id", user.id)
    .maybeSingle();

  if (order?.razorpay_order_id !== razorpayOrderId) {
    return { error: "That payment doesn't match this order." };
  }

  const { error } = await createAdminClient().rpc("verify_razorpay_order", {
    p_rzp_order: razorpayOrderId,
    p_payment_id: razorpayPaymentId,
  });

  if (error) {
    console.error("[razorpay] grant failed", error);
    return { error: "Payment received, but unlocking failed. We'll sort it — nothing was lost." };
  }

  revalidatePath(`/pay/${ref}`);
  return { ok: true };
}
