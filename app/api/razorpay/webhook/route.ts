import { createAdminClient } from "@/lib/supabase/admin";
import { verifyWebhookSignature } from "@/lib/razorpay";
import { isRazorpay, paymentMode } from "@/lib/payments";
import { NextResponse } from "next/server";

/**
 * The reliability half of the Razorpay rail.
 *
 * The checkout callback in the browser is the fast path, and it is the one that
 * fails: the payer's connection drops, they close the tab on the bank's page, or
 * the redirect back never happens. Money has moved and nothing granted access.
 * This endpoint is what makes that recoverable, and it is the reason the grant
 * function is idempotent — on a normal successful payment BOTH paths fire.
 *
 * Authentication is the signature and nothing else. There is no session here:
 * the caller is Razorpay's server, so the whole trust decision is one HMAC over
 * the raw body. `verifyWebhookSignature` returns false when the secret is unset,
 * which is deliberate — an unconfigured webhook must reject rather than grant.
 *
 * Not excluded from the proxy matcher: unlike the board route this is not
 * cacheable and not high-volume — it fires once per real payment — so the
 * session refresh it costs is noise, not a bill.
 */
export const dynamic = "force-dynamic";

/** The events that mean "the money is ours". `authorized` is not one of them. */
const GRANTS = new Set(["payment.captured", "order.paid"]);

export async function POST(request: Request) {
  // Read once, as text. Re-serialising the parsed JSON changes the bytes and
  // every signature check would fail — the HMAC is over what was actually sent.
  const raw = await request.text();

  if (!verifyWebhookSignature(raw, request.headers.get("x-razorpay-signature"))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  if (!isRazorpay(paymentMode())) {
    // Signed correctly but the rail is off — a stale webhook from another
    // deployment. Acknowledge it so Razorpay stops retrying; grant nothing.
    return NextResponse.json({ ok: true, ignored: "rail off" });
  }

  const event = JSON.parse(raw) as {
    event?: string;
    payload?: { payment?: { entity?: { id?: string; order_id?: string } } };
  };

  if (!event.event || !GRANTS.has(event.event)) {
    return NextResponse.json({ ok: true, ignored: event.event ?? "unknown" });
  }

  const payment = event.payload?.payment?.entity;
  if (!payment?.id || !payment.order_id) {
    return NextResponse.json({ ok: true, ignored: "no payment entity" });
  }

  const { error } = await createAdminClient().rpc("verify_razorpay_order", {
    p_rzp_order: payment.order_id,
    p_payment_id: payment.id,
  });

  if (error) {
    // NO_ORDER means the payment belongs to a different MaxPoll deployment
    // sharing these keys — nothing to do, and retrying will not help.
    if (error.message?.includes("NO_ORDER")) {
      return NextResponse.json({ ok: true, ignored: "unknown order" });
    }
    // Anything else: 500, so Razorpay retries. Money has moved; dropping this
    // silently is the one outcome worth a failed request.
    console.error("[razorpay] webhook grant failed", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
