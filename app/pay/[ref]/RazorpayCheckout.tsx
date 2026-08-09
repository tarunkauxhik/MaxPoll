"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { confirmRazorpayPayment, ensureRazorpayOrder } from "../razorpay-actions";

/**
 * The checkout button.
 *
 * Nothing here decides anything about money. It opens Razorpay's modal against
 * an order id the server made, hands the result straight back to the server, and
 * renders whatever the server says. Amount, price and entitlement all live on
 * the other side of that boundary — see app/pay/razorpay-actions.ts.
 *
 * The script is fetched on the first click rather than with the page: most
 * people who land on a paywall do not pay, and checkout.js is ~120KB that
 * otherwise lands on every one of them.
 */

type CheckoutResult = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayCtor = new (options: Record<string, unknown>) => { open: () => void };
declare global {
  interface Window {
    Razorpay?: RazorpayCtor;
  }
}

const SRC = "https://checkout.razorpay.com/v1/checkout.js";

function loadCheckout(): Promise<RazorpayCtor> {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);

  return new Promise((resolve, reject) => {
    // Reuse the tag if a previous click already started the fetch — two <script>
    // elements for the same src both run, and the second overwrites the first
    // mid-modal.
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SRC}"]`);
    const tag = existing ?? Object.assign(document.createElement("script"), { src: SRC });

    tag.addEventListener("load", () =>
      window.Razorpay ? resolve(window.Razorpay) : reject(new Error("no Razorpay global"))
    );
    tag.addEventListener("error", () => reject(new Error("checkout.js failed to load")));
    if (!existing) document.body.appendChild(tag);
  });
}

export function RazorpayCheckout({
  orderRef,
  keyId,
  amountPaise,
  amountLabel,
  description,
  name,
  email,
}: {
  orderRef: string;
  keyId: string;
  amountPaise: number;
  amountLabel: string;
  description: string;
  name: string;
  email: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pay = useCallback(async () => {
    setBusy(true);
    setError(null);

    const created = await ensureRazorpayOrder(orderRef);
    if ("error" in created) {
      setError(created.error);
      setBusy(false);
      return;
    }

    let Razorpay: RazorpayCtor;
    try {
      Razorpay = await loadCheckout();
    } catch {
      setError("Couldn't load the payment window. Check your connection and try again.");
      setBusy(false);
      return;
    }

    new Razorpay({
      key: keyId,
      // Razorpay charges what the *order* says, not what this line says — it is
      // here because checkout renders it, and a mismatch would only mislead.
      amount: amountPaise,
      currency: "INR",
      order_id: created.orderId,
      name: "MaxPoll",
      description,
      prefill: { name, email },
      theme: { color: "#3B4FD8" },

      handler: async (res: CheckoutResult) => {
        const done = await confirmRazorpayPayment(
          orderRef,
          res.razorpay_order_id,
          res.razorpay_payment_id,
          res.razorpay_signature
        );
        if (done.error) {
          setError(done.error);
          setBusy(false);
          return;
        }
        // The page renders its own "You're in" state off `orders.status`, so
        // there is nothing to navigate to — just re-read it.
        router.refresh();
      },

      modal: {
        // Closing the modal leaves the order pending, which is correct: they can
        // come back to this same URL and finish.
        ondismiss: () => setBusy(false),
      },
    }).open();
  }, [orderRef, keyId, amountPaise, description, name, email, router]);

  return (
    <>
      <button type="button" className="btn accent" onClick={pay} disabled={busy}>
        {busy ? "Opening…" : <>Pay ₹<span className="num">{amountLabel}</span></>}
      </button>

      {error && (
        <p className="fielderr" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
