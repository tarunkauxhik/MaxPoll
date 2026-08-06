"use client";

import { useState, useTransition } from "react";
import { Sheet } from "./Sheet";
import { report } from "@/app/p/[slug]/option-actions";
import { signInWithGoogle } from "@/lib/auth-actions";
import { Emoji } from "@/components/ui/Emoji";

/**
 * doc 03 §K / 01-product's "person-poll defamation → report, auto-hide at 3".
 *
 * The RPC has existed since Phase 6 and nothing ever called it, while `/terms`
 * told every user they could report a poll, an option or a message. This is that
 * promise, implemented.
 *
 * Deliberately quiet in the layout: a prominent report button on a poll about
 * named people invites brigading, and the 3-distinct-reporter threshold is what
 * makes it safe to offer at all.
 */
export function ReportButton({
  targetType,
  targetId,
  label,
  signedIn,
  returnTo,
  emphasis = "quiet",
}: {
  targetType: "option" | "message" | "poll";
  targetId: string;
  /** What is being reported, shown back so nobody reports the wrong row. */
  label: string;
  signedIn: boolean;
  returnTo: string;
  /**
   * "visible" reads as an available action rather than fine print — used on
   * person polls, where the report path matters more than on a poll about a
   * thing. Still a real button either way; this only changes how loud it is.
   */
  emphasis?: "quiet" | "visible";
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function send() {
    start(async () => {
      const res = await report(targetType, targetId, reason);
      if (res.ok) {
        setDone(true);
        setError(null);
      } else {
        setError(res.message ?? "Couldn't send that report.");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        className={emphasis === "visible" ? "reportlink chip" : "reportlink"}
        onClick={() => (signedIn ? setOpen(true) : signInWithGoogle(returnTo))}
      >
        {emphasis === "visible" ? (
          <>
            <Emoji char="🚩" /> Report this poll
          </>
        ) : (
          "Report"
        )}
      </button>

      <Sheet
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) {
            setDone(false);
            setReason("");
            setError(null);
          }
        }}
        title={done ? "Report sent" : "Report this"}
        description={label}
      >
        {done ? (
          <>
            {/* Says what happens next, and does not claim the content is gone —
                it takes three separate people, and pretending otherwise would be
                the same kind of promise /terms was already making. */}
            <p className="t-sec">
              Thanks. Content is hidden automatically once three different people
              report it, and we review reports directly.
            </p>
            <button type="button" className="btn pri" onClick={() => setOpen(false)}>
              Done
            </button>
          </>
        ) : (
          <>
            <label className="lbl" htmlFor="rep-reason">
              What&apos;s wrong with it? <span className="hint">Optional</span>
            </label>
            <textarea
              id="rep-reason"
              className="field"
              rows={3}
              maxLength={300}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Abusive, a real person who didn't consent, spam…"
            />

            {error && (
              <p className="fielderr" role="alert">
                {error}
              </p>
            )}

            <button type="button" className="btn danger" onClick={send} disabled={pending}>
              {pending ? "Sending…" : "Send report"}
            </button>
            <button type="button" className="btn sec" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </>
        )}
      </Sheet>
    </>
  );
}
