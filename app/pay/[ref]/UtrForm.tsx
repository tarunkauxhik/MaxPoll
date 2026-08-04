"use client";

import { useActionState } from "react";
import { submitUtr, type UtrState } from "../actions";

export function UtrForm({ orderRef }: { orderRef: string }) {
  const [state, action, pending] = useActionState<UtrState, FormData>(submitUtr, {});

  return (
    <form action={action} className="utrform">
      <input type="hidden" name="ref" value={orderRef} />

      <label className="lbl" htmlFor="utr">
        UTR / reference number
      </label>
      <input
        id="utr"
        name="utr"
        className="field"
        // Numeric keypad on mobile; pattern gives the browser a free check.
        inputMode="numeric"
        pattern="\d{12}"
        maxLength={12}
        placeholder="12 digits"
        required
        autoComplete="off"
      />
      <p className="hint">
        In your UPI app this is called UTR, Transaction ID, or Reference number.
      </p>

      <label className="lbl" htmlFor="contact">
        Email or phone <span className="lbl-opt">optional</span>
      </label>
      <input id="contact" name="contact" className="field" autoComplete="off" />
      <p className="hint">Only used if something goes wrong with this payment.</p>

      {state.error && (
        <p className="fielderr" role="alert">
          {state.error}
        </p>
      )}

      <button type="submit" className="btn pri" disabled={pending}>
        {pending ? "Submitting…" : "I've paid — verify it"}
      </button>
    </form>
  );
}
