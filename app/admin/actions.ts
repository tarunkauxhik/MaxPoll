"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { isAdmin, type OrderKind } from "@/lib/payments";
import { revalidatePath } from "next/cache";

/**
 * Every action here re-checks admin status itself.
 *
 * The admin client bypasses RLS completely, so the database will not stop a
 * mistake — there is no second line of defence below this function. A Server
 * Action is a public HTTP endpoint; guarding only the page that renders the
 * buttons would leave these callable by anyone who found the action id.
 */
async function requireAdmin() {
  const user = await getUser();
  if (!isAdmin(user?.id)) throw new Error("NOT_ADMIN");
  return user!;
}

export type AdminState = { error?: string; ok?: string };

/** Approve a manual UPI payment. verify_order() does both writes in one
 *  transaction — half of it landing is someone paying and not getting in. */
export async function verifyOrder(_prev: AdminState, form: FormData): Promise<AdminState> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return { error: "Not authorised." };
  }

  const id = String(form.get("id") ?? "");
  const supabase = createAdminClient();
  const { error } = await supabase.rpc("verify_order", { p_order: id, p_admin: admin.id });

  if (error) {
    if (error.message?.includes("NOT_PENDING")) {
      return { error: "That order was already decided." };
    }
    return { error: "Couldn't verify. Try again." };
  }

  revalidatePath("/admin");
  return { ok: "Verified — access granted." };
}

export async function rejectOrder(_prev: AdminState, form: FormData): Promise<AdminState> {
  try {
    await requireAdmin();
  } catch {
    return { error: "Not authorised." };
  }

  const id = String(form.get("id") ?? "");
  const note = String(form.get("note") ?? "").trim();
  // Required: this note is the only thing the payer ever sees back.
  if (note.length < 3) return { error: "Give a reason — the payer sees it." };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("orders")
    .update({ status: "rejected", admin_note: note, decided_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "submitted");

  if (error) return { error: "Couldn't reject. Try again." };

  revalidatePath("/admin");
  return { ok: "Rejected." };
}

/**
 * Grant access directly, with no payment.
 *
 * This is the only working path to paid access until a VPA exists: with no VPA
 * there are no UPI orders, so the queue above has nothing in it. Written as
 * `source='comp'` so the ledger says plainly that no money moved, rather than
 * carrying an invented payment reference.
 */
export async function grantAccess(_prev: AdminState, form: FormData): Promise<AdminState> {
  try {
    await requireAdmin();
  } catch {
    return { error: "Not authorised." };
  }

  const handle = String(form.get("handle") ?? "").trim().toLowerCase().replace(/^@/, "");
  const kind = String(form.get("kind") ?? "") as OrderKind;
  const pollSlug = String(form.get("poll_slug") ?? "").trim();

  if (!handle) return { error: "Enter a handle." };

  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("handle", handle)
    .maybeSingle();
  if (!profile) return { error: `No user @${handle}.` };

  let pollId: string | null = null;
  if (kind === "poll_unlock") {
    if (!pollSlug) return { error: "A poll unlock needs a poll slug." };
    const { data: poll } = await supabase
      .from("polls")
      .select("id")
      .eq("slug", pollSlug)
      .maybeSingle();
    if (!poll) return { error: `No poll "${pollSlug}".` };
    pollId = poll.id;
  }

  // The (source, payment_ref) unique index can't help here — comp grants carry
  // no reference — so double-granting is checked explicitly.
  const { data: existing } = await supabase
    .from("entitlements")
    .select("id")
    .eq("user_id", profile.id)
    .eq("kind", kind === "pass_30d" ? "sub_monthly" : "poll_unlock")
    .eq("poll_id", pollId)
    .maybeSingle();
  if (existing) return { error: `@${handle} already has that.` };

  const { error } = await supabase.from("entitlements").insert({
    user_id: profile.id,
    poll_id: pollId,
    kind: kind === "pass_30d" ? "sub_monthly" : "poll_unlock",
    source: "comp",
    expires_at:
      kind === "pass_30d"
        ? new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString()
        : null,
  });

  if (error) return { error: "Couldn't grant. Try again." };

  revalidatePath("/admin");
  return { ok: `Granted to @${handle} (${profile.display_name}).` };
}
