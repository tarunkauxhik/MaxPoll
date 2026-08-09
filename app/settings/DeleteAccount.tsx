"use client";

import { useActionState, useState } from "react";
import { deleteAccount, type DeleteState } from "./actions";

export function DeleteAccount({ handle }: { handle: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<DeleteState, FormData>(deleteAccount, {});

  if (!open) {
    return (
      <button type="button" className="btn sec danger fullw" onClick={() => setOpen(true)}>
        Delete account
      </button>
    );
  }

  return (
    <form action={action} className="delbox">
      <h2 className="t-card">Delete your account</h2>
      {/* States the vote behaviour explicitly — RULES.md. */}
      <p className="t-sec">
        Your profile, memberships and unlocks are deleted. <b>Your votes stay, anonymised</b> —
        removing them would silently change the counts on every poll you voted in.
        This can&apos;t be undone.
      </p>

      <label className="lbl" htmlFor="confirm">
        Type @{handle} to confirm
      </label>
      <input id="confirm" name="confirm" className="field" autoCapitalize="none" required />

      {state.error && (
        <p className="fielderr" role="alert">
          {state.error}
        </p>
      )}

      <button type="submit" className="btn danger fullw" disabled={pending}>
        {pending ? "Deleting…" : "Delete my account"}
      </button>
      <button type="button" className="btn sec fullw" onClick={() => setOpen(false)}>
        Keep my account
      </button>
    </form>
  );
}
