import { notFound, redirect } from "next/navigation";
import AppShell from "@/components/shell/AppShell";
import { createClient } from "@/lib/supabase/server";
import { paymentMode, upiIntentUrl, rupees } from "@/lib/payments";
import { UtrForm } from "./UtrForm";
import { Emoji } from "@/components/ui/Emoji";
import Link from "next/link";
import QRCode from "qrcode";

export const metadata = { title: "Pay · MaxPoll" };

/**
 * The payment page — a page, not a modal (03-ux-flows G). The payer leaves to
 * their UPI app and comes back, so they need a URL they can return to.
 */
export default async function PayPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  // RLS already restricts this to the payer's own orders; the filter is belt
  // and braces, and it makes someone else's ref a 404 rather than an empty page.
  const { data: order } = await supabase
    .from("orders")
    .select("ref, kind, amount_paise, status, admin_note, poll_id, utr, polls:poll_id(slug)")
    .eq("ref", ref)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!order) notFound();

  const amount = rupees(order.amount_paise);
  const what = order.kind === "pass_30d" ? "30-day pass" : "this poll";

  // /p/[slug], not the poll's uuid — linking the id would 404.
  const rel = order.polls as { slug: string } | { slug: string }[] | null;
  const pollSlug = (Array.isArray(rel) ? rel[0] : rel)?.slug ?? null;

  if (order.status === "verified") {
    return (
      <AppShell>
        <div className="state">
          <div className="ic">
            <Emoji char="✅" />
          </div>
          <h1 className="t-card">You&apos;re in</h1>
          <p>Names are unlocked on {what}.</p>
          <Link className="btn pri" href={pollSlug ? `/p/${pollSlug}` : "/"}>
            See who voted
          </Link>
        </div>
      </AppShell>
    );
  }

  if (order.status === "rejected") {
    return (
      <AppShell>
        <div className="state err" role="alert">
          <div className="ic">
            <Emoji char="⚠" />
          </div>
          <h1 className="t-card">We couldn&apos;t match that payment</h1>
          {/* The admin's note verbatim — it is the only thing the payer gets back. */}
          <p>{order.admin_note || "The reference number didn't match a payment we received."}</p>
          <p className="hint">
            Reference <span className="num">{order.ref}</span>
          </p>
        </div>
      </AppShell>
    );
  }

  if (order.status === "submitted") {
    return (
      <AppShell>
        <div className="state">
          <div className="ic">
            <Emoji char="⏳" />
          </div>
          <h1 className="t-card">Got it — checking your payment</h1>
          <p>Usually within a few hours. This page updates when it&apos;s done.</p>
          <p className="hint">
            Reference <span className="num">{order.ref}</span> · UTR{" "}
            <span className="num">{order.utr}</span>
          </p>
        </div>
      </AppShell>
    );
  }

  // ── pending ────────────────────────────────────────────────────────────────
  const mode = paymentMode();
  if (mode !== "manual_upi") {
    return (
      <AppShell>
        <div className="state">
          <div className="ic">
            <Emoji char="🔒" />
          </div>
          <h1 className="t-card">Unlocking soon</h1>
          <p>We&apos;re finishing payments. Nothing has been charged.</p>
          <Link className="btn sec" href="/">
            Back to polls
          </Link>
        </div>
      </AppShell>
    );
  }

  const intent = upiIntentUrl(order.ref, order.amount_paise);
  // Server-rendered SVG: zero client JS, no canvas, nothing added to the LCP
  // budget. The QR encodes exactly the same string as the mobile intent link.
  const qr = await QRCode.toString(intent, {
    type: "svg",
    margin: 0,
    errorCorrectionLevel: "M",
  });

  return (
    <AppShell>
      <div className="paywrap">
        <h1 className="t-title">
          Pay ₹<span className="num">{amount}</span>
        </h1>
        <p className="t-sec">Unlocks {what}.</p>

        <ol className="paysteps">
          <li>
            <span className="s num">1</span>
            <span>Pay with any UPI app — scan the code, or tap the button on mobile.</span>
          </li>
          <li>
            <span className="s num">2</span>
            <span>
              Copy the <b>12-digit UTR</b> your app shows after paying.
            </span>
          </li>
          <li>
            <span className="s num">3</span>
            <span>Paste it below. We verify and unlock, usually within a few hours.</span>
          </li>
        </ol>

        <div className="qrbox">
          {/*
            Our own SVG, generated server-side from a string we built from the
            VPA and this order's ref. No user-supplied text reaches it, so there
            is nothing here to inject.
          */}
          <div className="qr" dangerouslySetInnerHTML={{ __html: qr }} aria-hidden="true" />
          <p className="hint lcenter">
            Reference <span className="num">{order.ref}</span>
          </p>
        </div>

        <a className="btn vio payintent" href={intent}>
          Pay ₹<span className="num">{amount}</span> in your UPI app
        </a>
        <p className="hint lcenter">On a phone, this opens GPay / PhonePe / Paytm.</p>

        <UtrForm orderRef={order.ref} />

        {/* MaxPoll collects on an individual UPI account, so the payer's app shows
            a person's name and not "MaxPoll". Saying so here is the cheapest fix
            for the "wait, who am I paying?" moment that otherwise abandons the
            payment. Remove this line the day the business VPA lands — DECISIONS D6. */}
        <p className="discl">
          <Emoji char="🔓" />
          <span>
            Your UPI app will show an individual&apos;s name — MaxPoll is run by one
            person and collects on a personal account. Non-refundable. Pay the exact
            amount shown, or we can&apos;t match it.
          </span>
        </p>
      </div>
    </AppShell>
  );
}
