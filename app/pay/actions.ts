"use server";

import { createClient } from "@/lib/supabase/server";
import { paymentsEnabled, isValidUtr, type OrderKind } from "@/lib/payments";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

/**
 * Start an order. The client sends `kind` and `pollId` and nothing else —
 * `ref` is defaulted by the database and `amount_paise` is a generated column,
 * so neither is client-authored (DECISIONS D2b).
 */
export async function startOrder(
  kind: OrderKind,
  pollId: string | null,
  /** For redirects — /p/ takes a slug, and linking the uuid would 404. */
  pollSlug?: string
) {
  if (!paymentsEnabled()) redirect("/?error=payments_off");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  // Already own it? Don't take money twice.
  const { data: owned } = await supabase
    .from("entitlements")
    .select("id, kind, poll_id, expires_at")
    .eq("user_id", user.id);

  const now = Date.now();
  const has = (owned ?? []).some(
    (e: { kind: string; poll_id: string | null; expires_at: string | null }) =>
      (e.poll_id === pollId || e.kind === "sub_monthly") &&
      (e.expires_at === null || new Date(e.expires_at).getTime() > now)
  );
  if (has) redirect(pollSlug ? `/p/${pollSlug}` : "/");

  // Reuse an order that's still open rather than stacking duplicates — the
  // orders_open_uniq index would reject the insert anyway.
  const { data: existing } = await supabase
    .from("orders")
    .select("ref")
    .eq("user_id", user.id)
    .eq("kind", kind)
    .in("status", ["pending", "submitted"])
    .maybeSingle();

  if (existing) redirect(`/pay/${existing.ref}`);

  const { data, error } = await supabase
    .from("orders")
    .insert({ user_id: user.id, poll_id: pollId, kind })
    .select("ref")
    .single();

  if (error || !data) redirect("/?error=order");
  redirect(`/pay/${data.ref}`);
}

export type UtrState = { error?: string };

/** Attach the 12-digit reference. This is all a payer can do — approving is
 *  service-role only, and `status` is the only status value they may write. */
export async function submitUtr(_prev: UtrState, form: FormData): Promise<UtrState> {
  const ref = String(form.get("ref") ?? "");
  const utr = String(form.get("utr") ?? "").trim();
  const contact = String(form.get("contact") ?? "").trim();

  if (!isValidUtr(utr)) {
    return { error: "That's not a 12-digit UPI reference number." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You're signed out. Sign in and try again." };

  const { error } = await supabase
    .from("orders")
    .update({
      utr,
      contact: contact || null,
      status: "submitted",
      submitted_at: new Date().toISOString(),
    })
    .eq("ref", ref)
    .eq("user_id", user.id)
    .eq("status", "pending");

  if (error) {
    // 23505 on orders_utr_uniq: this reference already unlocked something.
    if (error.code === "23505") {
      return {
        error:
          "That reference number has already been used. Check the number, or contact us if this is wrong.",
      };
    }
    return { error: "Couldn't save that. Try again." };
  }

  revalidatePath(`/pay/${ref}`);
  return {};
}
