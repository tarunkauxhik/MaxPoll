"use client";

import { useActionState, useState } from "react";
import { Sheet } from "@/components/poll/Sheet";
import {
  grantAccess,
  verifyOrder,
  rejectOrder,
  revokeAccess,
  moderate,
  type AdminState,
} from "./actions";

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

/** Absolute date + time. `ago()` is right for a feed and wrong for a ledger — a
 *  payment dispute needs the actual timestamp, not "2 days ago". */
function stamp(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="dfield">
      <span className="dlabel">{label}</span>
      <span className="dvalue">{children}</span>
    </div>
  );
}

export type OrderRowProps = {
  id: string;
  ref_: string;
  expected: string;
  utr: string;
  who: string;
  whoName: string | null;
  what: string;
  kind: string;
  pollSlug: string | null;
  contact: string | null;
  when: string;
  createdAt: string;
  submittedAt: string | null;
  decidedAt: string | null;
  adminNote: string | null;
  status: string;
};

/**
 * A queued payment. The row is a summary; the decision happens in the sheet.
 *
 * Verify/Reject live inside the detail rather than on the row because approving
 * a payment from a two-line summary is how the wrong one gets approved — the
 * expected amount and the UTR have to be read together, and a row that fits four
 * to a phone screen does not make anyone read them.
 */
export function OrderRow(p: OrderRowProps) {
  const [vState, vAction, vPending] = useActionState<AdminState, FormData>(verifyOrder, {});
  const [rState, rAction, rPending] = useActionState<AdminState, FormData>(rejectOrder, {});
  const [rejecting, setRejecting] = useState(false);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="qrow" onClick={() => setOpen(true)}>
        <span className="qmeta">
          <span className="rankpill num">{p.ref_}</span>
          <b>
            ₹<span className="num">{p.expected}</span>
          </b>
          <span className="t-sec qwhat">{p.what}</span>
        </span>
        <span className="qsub">
          {p.who} · UTR <span className="num">{p.utr || "—"}</span> · {p.when}
        </span>
        <span className="qchev" aria-hidden="true">
          ›
        </span>
      </button>

      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={`Order ${p.ref_}`}
        description={`${p.who}${p.whoName ? ` · ${p.whoName}` : ""}`}
      >
        <div className="detail">
          {/* Expected next to submitted, deliberately adjacent: a UPI intent's
              `am` is editable and a static QR carries none, so a human comparing
              these two IS the amount check. Nothing else performs it. */}
          <Field label="Expected">
            ₹<span className="num">{p.expected}</span>
          </Field>
          <Field label="UTR submitted">
            <span className="num">{p.utr || "not submitted"}</span>
          </Field>
          <Field label="For">
            {p.kind === "pass_30d" ? (
              "30-day pass"
            ) : p.pollSlug ? (
              <a href={`/p/${p.pollSlug}`}>{p.what}</a>
            ) : (
              p.what
            )}
          </Field>
          <Field label="Payer">
            <a href={`/u/${p.who.replace(/^@/, "")}`}>{p.who}</a>
            {p.whoName && ` · ${p.whoName}`}
          </Field>
          <Field label="Contact">{p.contact || "not given"}</Field>
          <Field label="Status">{p.status}</Field>
          <Field label="Order created">{stamp(p.createdAt)}</Field>
          <Field label="UTR submitted at">{stamp(p.submittedAt)}</Field>
          <Field label="Decided">{stamp(p.decidedAt)}</Field>
          {p.adminNote && <Field label="Note to payer">{p.adminNote}</Field>}
        </div>

        {(vState.error || rState.error) && (
          <p className="fielderr" role="alert">
            {vState.error ?? rState.error}
          </p>
        )}

        {rejecting ? (
          <form action={rAction} className="rejform">
            <input type="hidden" name="id" value={p.id} />
            <label className="lbl" htmlFor={`note-${p.id}`}>
              Reason (the payer sees this)
            </label>
            <input
              id={`note-${p.id}`}
              name="note"
              className="field"
              placeholder="No payment found with that UTR"
              required
            />
            <div className="qactions">
              <button type="submit" className="btn danger" disabled={rPending}>
                {rPending ? "Rejecting…" : "Confirm reject"}
              </button>
              <button type="button" className="btn sec" onClick={() => setRejecting(false)}>
                Back
              </button>
            </div>
          </form>
        ) : (
          <div className="qactions">
            <form action={vAction}>
              <input type="hidden" name="id" value={p.id} />
              <button type="submit" className="btn pri" disabled={vPending}>
                {vPending ? "Verifying…" : `Verify ₹${p.expected}`}
              </button>
            </form>
            <button type="button" className="btn sec" onClick={() => setRejecting(true)}>
              Reject
            </button>
          </div>
        )}
      </Sheet>
    </>
  );
}

export type ReportRow = {
  type: string;
  id: string;
  count: number;
  reasons: string[];
  text: string;
  hidden: boolean;
  href: string | null;
};

const TARGET_LABEL: Record<string, string> = {
  option: "Option",
  poll: "Poll",
  message: "Chat message",
};

/**
 * Reported content, most-reported first.
 *
 * The 3-reporter auto-hide is a floor, not the policy — one credible report
 * about a named real person should not wait for two strangers to agree.
 */
export function ModerationQueue({ rows }: { rows: ReportRow[] }) {
  if (rows.length === 0) return <p className="t-sec">Nothing reported.</p>;
  return (
    <ul className="queue">
      {rows.map((r) => (
        <li key={`${r.type}:${r.id}`}>
          <ReportedRow row={r} />
        </li>
      ))}
    </ul>
  );
}

function ReportedRow({ row }: { row: ReportRow }) {
  const [state, action, pending] = useActionState<AdminState, FormData>(moderate, {});

  return (
    <div className="grow">
      <div className="gmeta">
        <span className="gtag report">
          {TARGET_LABEL[row.type] ?? row.type} · <span className="num">{row.count}</span>
        </span>
        {row.hidden && <span className="gtag lapsed">Hidden</span>}
      </div>

      <p className="repbody">
        {row.href ? <a href={row.href}>{row.text}</a> : row.text}
      </p>

      {row.reasons.length > 0 && (
        <ul className="repreasons">
          {row.reasons.map((why, i) => (
            <li key={i}>“{why}”</li>
          ))}
        </ul>
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

      <form action={action} className="qactions">
        <input type="hidden" name="target_type" value={row.type} />
        <input type="hidden" name="target_id" value={row.id} />
        {row.hidden ? (
          <button type="submit" name="act" value="show" className="btn sm sec" disabled={pending}>
            Restore
          </button>
        ) : (
          <button type="submit" name="act" value="hide" className="btn sm danger" disabled={pending}>
            {row.type === "poll" ? "Remove poll" : "Hide it"}
          </button>
        )}
        <button type="submit" name="act" value="dismiss" className="btn sm sec dim" disabled={pending}>
          Dismiss
        </button>
      </form>
    </div>
  );
}

export type GrantRow = {
  id: string;
  who: string;
  whoName: string | null;
  what: string;
  pollSlug: string | null;
  source: string;
  paymentRef: string | null;
  when: string;
  expired: boolean;
  expiresAt: string | null;
};

const SOURCE_LABEL: Record<string, string> = {
  manual_upi: "Paid · UPI",
  razorpay: "Paid · Razorpay",
  comp: "Comped",
};

/** Who currently has access. `entitlements` is the access grant; `orders` is the
 *  ledger — revoking here never rewrites what was paid (DECISIONS D2). */
export function GrantedList({ rows }: { rows: GrantRow[] }) {
  if (rows.length === 0) {
    return <p className="t-sec">Nobody has access yet.</p>;
  }

  return (
    <ul className="queue">
      {rows.map((g) => (
        <li key={g.id}>
          <GrantedRow row={g} />
        </li>
      ))}
    </ul>
  );
}

function GrantedRow({ row }: { row: GrantRow }) {
  const [state, action, pending] = useActionState<AdminState, FormData>(revokeAccess, {});
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="grow">
      <div className="gmeta">
        <a className="ghandle" href={`/u/${row.who.replace(/^@/, "")}`}>
          {row.who}
        </a>
        <span className={`gtag ${row.source === "comp" ? "comp" : "paid"}`}>
          {SOURCE_LABEL[row.source] ?? row.source}
        </span>
        {row.expired && <span className="gtag lapsed">Lapsed</span>}
      </div>

      <p className="t-sec">
        {row.pollSlug ? <a href={`/p/${row.pollSlug}`}>{row.what}</a> : row.what}
      </p>
      <p className="hint">
        {row.when}
        {row.paymentRef && ` · UTR ${row.paymentRef}`}
        {row.expiresAt && ` · ${row.expired ? "expired" : "expires"} ${stamp(row.expiresAt)}`}
      </p>

      {state.error && (
        <p className="fielderr" role="alert">
          {state.error}
        </p>
      )}

      {confirming ? (
        <form action={action} className="qactions">
          <input type="hidden" name="id" value={row.id} />
          <button type="submit" className="btn sm danger" disabled={pending}>
            {pending ? "Revoking…" : "Confirm revoke"}
          </button>
          <button type="button" className="btn sm sec dim" onClick={() => setConfirming(false)}>
            Cancel
          </button>
        </form>
      ) : (
        <div className="qactions">
          <button type="button" className="btn sm sec" onClick={() => setConfirming(true)}>
            Revoke
          </button>
        </div>
      )}
    </div>
  );
}
