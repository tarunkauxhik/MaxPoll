"use client";

import { useActionState, useState } from "react";
import { grantAccess, verifyOrder, rejectOrder, type AdminState } from "./actions";

export function GrantForm() {
  const [state, action, pending] = useActionState<AdminState, FormData>(grantAccess, {});
  const [kind, setKind] = useState("poll_unlock");

  return (
    <form action={action} className="grantform">
      <label className="lbl" htmlFor="handle">
        Handle
      </label>
      <input id="handle" name="handle" className="field" placeholder="@tarun" required autoCapitalize="none" />

      <label className="lbl" htmlFor="kind">
        What to grant
      </label>
      <select
        id="kind"
        name="kind"
        className="field"
        value={kind}
        onChange={(e) => setKind(e.target.value)}
      >
        <option value="poll_unlock">₹9 — one poll</option>
        <option value="pass_30d">₹99 — 30-day pass</option>
      </select>

      {kind === "poll_unlock" && (
        <>
          <label className="lbl" htmlFor="poll_slug">
            Poll slug
          </label>
          <input id="poll_slug" name="poll_slug" className="field" placeholder="dtu-best-teacher" />
        </>
      )}

      {state.error && (
        <p className="fielderr" role="alert">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="okmsg" role="status">
          {state.ok}
        </p>
      )}

      <button type="submit" className="btn pri" disabled={pending}>
        {pending ? "Granting…" : "Grant access"}
      </button>
    </form>
  );
}

export function OrderRow({
  id,
  ref_,
  expected,
  utr,
  who,
  what,
  contact,
  when,
}: {
  id: string;
  ref_: string;
  expected: string;
  utr: string;
  who: string;
  what: string;
  contact: string | null;
  when: string;
}) {
  const [vState, vAction, vPending] = useActionState<AdminState, FormData>(verifyOrder, {});
  const [rState, rAction, rPending] = useActionState<AdminState, FormData>(rejectOrder, {});
  const [rejecting, setRejecting] = useState(false);

  return (
    <div className="qrow">
      <div className="qmeta">
        <span className="rankpill num">{ref_}</span>
        <b>
          ₹<span className="num">{expected}</span> expected
        </b>
        <span className="t-sec">{what}</span>
      </div>

      <p className="qutr">
        UTR <span className="num">{utr}</span>
      </p>
      <p className="hint">
        {who} · {when}
        {contact && ` · ${contact}`}
      </p>

      {(vState.error || rState.error) && (
        <p className="fielderr" role="alert">
          {vState.error ?? rState.error}
        </p>
      )}

      {rejecting ? (
        <form action={rAction} className="rejform">
          <input type="hidden" name="id" value={id} />
          <label className="lbl" htmlFor={`note-${id}`}>
            Reason (the payer sees this)
          </label>
          <input
            id={`note-${id}`}
            name="note"
            className="field"
            placeholder="No payment found with that UTR"
            required
          />
          <div className="qactions">
            <button type="submit" className="btn sm sec" disabled={rPending}>
              {rPending ? "Rejecting…" : "Confirm reject"}
            </button>
            <button type="button" className="btn sm sec dim" onClick={() => setRejecting(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="qactions">
          <form action={vAction}>
            <input type="hidden" name="id" value={id} />
            <button type="submit" className="btn sm pri" disabled={vPending}>
              {vPending ? "Verifying…" : "Verify"}
            </button>
          </form>
          <button type="button" className="btn sm sec" onClick={() => setRejecting(true)}>
            Reject
          </button>
        </div>
      )}
    </div>
  );
}
