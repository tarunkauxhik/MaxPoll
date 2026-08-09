/**
 * The one payment switch. Everything payment-shaped reads from here.
 *
 * Two rails: manual UPI (a human reads a UTR off the merchant app) and Razorpay
 * (a signature off a webhook). Both write to the same `entitlements` table, so
 * nothing downstream of the money cares which one was used.
 *
 * Every read goes through `clean()`: a value pasted into Vercel with quotes round
 * it would otherwise fail closed *silently* here, which looks identical to "not
 * launched yet" — see docs/RULES.md.
 */
// Relative + explicit extension: this module is loaded raw by `node --test`,
// which does not know the `@/` alias. Same reason as lib/rank.ts.
import { clean } from "./env.ts";

export const PAYMENT_MODES = [
  "coming_soon",
  "manual_upi",
  "razorpay_test",
  "razorpay_live",
] as const;

export type PaymentMode = (typeof PAYMENT_MODES)[number];

/** Paise. Mirrored by the generated `orders.amount_paise` column — change both. */
export const PRICES = { poll_unlock: 900, pass_30d: 9900 } as const;

export type OrderKind = keyof typeof PRICES;

/**
 * Fails closed. An unset, misspelt, or half-deployed env var must never land on
 * a mode that takes money — and each rail additionally needs its own credential,
 * so a missing one degrades to coming_soon rather than rendering a payment
 * screen that quietly points nowhere.
 */
export function paymentMode(): PaymentMode {
  const raw = clean("NEXT_PUBLIC_PAYMENTS_MODE", process.env.NEXT_PUBLIC_PAYMENTS_MODE);
  const mode = PAYMENT_MODES.includes(raw as PaymentMode)
    ? (raw as PaymentMode)
    : "coming_soon";

  if (mode === "manual_upi" && !vpa()) return "coming_soon";

  /**
   * The key id carries its own environment in its prefix, so a test key
   * deployed under `razorpay_live` is detectable — and worth detecting. That
   * pairing takes real money against a test account (or the reverse, which
   * charges a real card from a staging branch), and Razorpay's own error for it
   * arrives in the browser after the payer has already committed.
   *
   * Checked here rather than in the checkout code because this is the function
   * every screen asks "are payments on?", and "on with the wrong keys" has to
   * answer no.
   */
  if (mode === "razorpay_test" || mode === "razorpay_live") {
    const prefix = mode === "razorpay_live" ? "rzp_live_" : "rzp_test_";
    if (!razorpayKeyId().startsWith(prefix)) return "coming_soon";
  }

  return mode;
}

export const paymentsEnabled = () => paymentMode() !== "coming_soon";

/** True when the checkout modal is the rail, rather than a UTR typed by hand. */
export const isRazorpay = (mode: PaymentMode) =>
  mode === "razorpay_test" || mode === "razorpay_live";

// NEXT_PUBLIC_UPI_VPA looks like an email but is a UPI payment handle, not a
// contact address — do not confuse it with app/legal.ts CONTACT_EMAIL.
const vpa = () => clean("NEXT_PUBLIC_UPI_VPA", process.env.NEXT_PUBLIC_UPI_VPA);

/**
 * Public by design — Razorpay's checkout script takes it as an option, so it is
 * in the page source of every merchant using them. The half that must never
 * leave the server is RAZORPAY_KEY_SECRET, which lives in lib/razorpay.ts behind
 * `server-only`.
 */
export const razorpayKeyId = () =>
  clean("NEXT_PUBLIC_RAZORPAY_KEY_ID", process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID);

/** Rupees for display. Every rendered amount goes through `.num` — RULES.md. */
export const rupees = (paise: number) =>
  (paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 });

/**
 * NPCI linking-spec intent URI. `tr` is the spec's transaction-reference field
 * and is where the order ref belongs; `tn` is a free-text note the payer can
 * edit, so it is never read back as identification.
 *
 * The amount here is a *hint* — several UPI apps let the payer change it, and a
 * static QR carries none. The real amount check is a human comparing
 * `orders.amount_paise` against the merchant app. See docs/RULES.md.
 */
export function upiIntentUrl(ref: string, paise: number) {
  const pa = vpa();
  if (!pa) throw new Error("NEXT_PUBLIC_UPI_VPA is not set");

  const q = new URLSearchParams({
    pa,
    pn: clean("NEXT_PUBLIC_UPI_PAYEE_NAME", process.env.NEXT_PUBLIC_UPI_PAYEE_NAME) || "MaxPoll",
    am: (paise / 100).toFixed(2),
    cu: "INR",
    tr: ref,
    tn: `MaxPoll ${ref}`,
  });
  // URLSearchParams encodes a space as `+`, which is correct for form bodies and
  // wrong here: a UPI app parsing the URI per RFC 3986 renders a literal plus, so
  // the payer reads "MaxPoll+MP4F2A1B" on their confirmation screen. `%20` is
  // read as a space by both kinds of parser.
  return `upi://pay?${q.toString().replace(/\+/g, "%20")}`;
}

/** UTRs are 12 digits. Length is all we can check client-side; the admin does the rest. */
export const isValidUtr = (utr: string) => /^\d{12}$/.test(utr.trim());

/** Server-only. An empty allowlist means nobody, never everybody. */
export function isAdmin(userId: string | undefined | null) {
  if (!userId) return false;
  return clean("ADMIN_USER_IDS", process.env.ADMIN_USER_IDS)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(userId);
}
