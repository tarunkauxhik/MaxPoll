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

  revalidatePath("/admin", "layout");
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

  revalidatePath("/admin", "layout");
  return { ok: "Rejected." };
}

/**
 * Act on reported content.
 *
 * `report_target()` auto-hides at 3 distinct reporters, which is the floor, not
 * the whole policy — one credible report about a real named person should not
 * wait for two more people to agree. doc 01 rates person-poll defamation High.
 *
 * `dismiss` deletes the reports rather than marking them: the table has no
 * status column, and a dismissed item that stays in the queue is a queue nobody
 * reads. The content is untouched.
 */
export async function moderate(_prev: AdminState, form: FormData): Promise<AdminState> {
  try {
    await requireAdmin();
  } catch {
    return { error: "Not authorised." };
  }

  const type = String(form.get("target_type") ?? "");
  const id = String(form.get("target_id") ?? "");
  const act = String(form.get("act") ?? "");
  if (!["option", "message", "poll"].includes(type)) return { error: "Unknown target." };

  const supabase = createAdminClient();

  if (act === "dismiss") {
    const { error } = await supabase
      .from("reports")
      .delete()
      .eq("target_type", type)
      .eq("target_id", id);
    if (error) return { error: "Couldn't dismiss. Try again." };
    revalidatePath("/admin", "layout");
    return { ok: "Dismissed — content left as it is." };
  }

  const hide = act === "hide";
  const { error } =
    type === "poll"
      ? await supabase
          .from("polls")
          .update({ status: hide ? "removed" : "live" })
          .eq("id", id)
      : await supabase.from(type === "option" ? "options" : "messages")
          .update({ hidden: hide })
          .eq("id", id);

  if (error) return { error: "Couldn't apply that. Try again." };

  revalidatePath("/admin", "layout");
  return { ok: hide ? "Hidden." : "Restored." };
}

/**
 * Undo a grant.
 *
 * `grantAccess` had no inverse, and every grant here is typed by hand — a
 * mis-typed handle or the wrong poll had to be fixed in the SQL editor.
 *
 * Deliberately *not* restricted to `source='comp'`: a verified payment can also
 * need reversing (a refund, a duplicate). The order row in the ledger stays
 * exactly as it was, which is the point of the orders/entitlements split — the
 * payment happened, the access no longer applies.
 */
export async function revokeAccess(_prev: AdminState, form: FormData): Promise<AdminState> {
  try {
    await requireAdmin();
  } catch {
    return { error: "Not authorised." };
  }

  const id = String(form.get("id") ?? "");
  if (!id) return { error: "No entitlement id." };

  const supabase = createAdminClient();
  const { error } = await supabase.from("entitlements").delete().eq("id", id);
  if (error) return { error: "Couldn't revoke. Try again." };

  revalidatePath("/admin", "layout");
  return { ok: "Access revoked." };
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

  revalidatePath("/admin", "layout");
  return { ok: `Granted to @${handle} (${profile.display_name}).` };
}

/**
 * Delete any poll or Space, as an admin.
 *
 * **The only unbounded delete in the product.** A creator's own delete goes
 * through `delete_poll()` / `delete_space()`, which check `auth.uid()` and, for
 * a Space, refuse once somebody else has posted in it. This bypasses both: the
 * admin client is the service role, so RLS and those functions are not in the
 * path at all.
 *
 * That is deliberate — moderation has to be able to remove a poll about a named
 * real person no matter who made it — and it is why `requireAdmin()` above is
 * the entire safety of this function. It re-checks rather than trusting the page
 * that rendered the button, because a Server Action is a public HTTP endpoint.
 *
 * Deleting a Space cascades to every poll inside it. The screen says so and asks
 * for the name to be typed; `confirm` is checked here as well, so a crafted
 * request cannot skip it.
 */
export async function adminDelete(_prev: AdminState, form: FormData): Promise<AdminState> {
  try {
    await requireAdmin();
  } catch {
    return { error: "Not authorised." };
  }

  const kind = String(form.get("kind") ?? "");
  const id = String(form.get("id") ?? "");
  const name = String(form.get("name") ?? "");
  const confirm = String(form.get("confirm") ?? "").trim();

  if (kind !== "poll" && kind !== "space") return { error: "Nothing to delete." };
  if (confirm !== name) {
    return { error: `Type ${kind === "poll" ? "the poll title" : "the Space name"} exactly to confirm.` };
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from(kind === "poll" ? "polls" : "spaces")
    .delete()
    .eq("id", id);

  if (error) return { error: "Couldn't delete. Try again." };

  revalidatePath("/admin", "layout");
  return {
    ok:
      kind === "poll"
        ? `Deleted the poll "${name}".`
        : `Deleted the Space "${name}" and every poll in it.`,
  };
}
