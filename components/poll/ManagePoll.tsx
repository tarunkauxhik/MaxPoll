"use client";

import { useActionState, useState, useTransition } from "react";
import { Sheet } from "./Sheet";
import {
  updatePoll,
  deletePoll,
  extendPoll,
  type ManageState,
} from "@/app/p/[slug]/manage-actions";
import { DeadlinePicker } from "./DeadlinePicker";

/**
 * The creator's controls — doc 06 shipped none, so a poll was permanently
 * immutable to the person who made it.
 *
 * Only rendered for the owner, but that is presentation: `update_poll()` and
 * `delete_poll()` check `auth.uid()` themselves, so hiding this button is not
 * what stops anyone else.
 */
export function ManagePoll({
  pollId,
  slug,
  title,
  closed,
  optionsLocked,
  hasVotes,
  expiresAt,
}: {
  pollId: string;
  slug: string;
  title: string;
  closed: boolean;
  optionsLocked: boolean;
  hasVotes: boolean;
  expiresAt: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [state, action, pending] = useActionState<ManageState, FormData>(updatePoll, {});
  const [delState, delAction, delPending] = useActionState<ManageState, FormData>(deletePoll, {});
  const [extendMsg, setExtendMsg] = useState<ManageState>({});
  const [extendPending, startExtend] = useTransition();

  function extend(hours: number) {
    startExtend(async () => {
      setExtendMsg(await extendPoll(pollId, slug, hours));
    });
  }

  return (
    <>
      <button type="button" className="btn sec" onClick={() => setOpen(true)}>
        ⚙️ Manage poll
      </button>

      <Sheet open={open} onOpenChange={setOpen} title="Manage poll" description={title}>
        <form action={action} className="managform">
          <input type="hidden" name="poll_id" value={pollId} />
          <input type="hidden" name="slug" value={slug} />

          <label className="lbl" htmlFor="m-title">
            Title
          </label>
          <input
            id="m-title"
            name="title"
            className="field"
            defaultValue={title}
            maxLength={120}
            required
          />

          <p className="lbl">Quick extend</p>
          <div className="btnrow extendrow">
            {[1, 6, 24].map((h) => (
              <button
                key={h}
                type="button"
                className="btn sm sec"
                disabled={extendPending}
                onClick={() => extend(h)}
              >
                +{h}h
              </button>
            ))}
          </div>
          {expiresAt === null && (
            <p className="hint">No deadline set; this adds from now.</p>
          )}
          {extendMsg.error && (
            <p className="fielderr" role="alert">
              {extendMsg.error}
            </p>
          )}
          {extendMsg.ok && (
            <p className="okmsg" role="status">
              {extendMsg.ok}
            </p>
          )}

          <p className="lbl">Deadline</p>
          <DeadlinePicker allowKeep current={expiresAt} />

          <label className="check">
            <input
              type="checkbox"
              name="lock_options"
              value="1"
              defaultChecked={optionsLocked}
            />
            <span>
              Lock options — nobody can add new names
              <span className="hint">Happens automatically at 10 votes.</span>
            </span>
          </label>

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
            {pending ? "Saving…" : "Save changes"}
          </button>

          {!closed && (
            <button
              type="submit"
              name="close"
              value="1"
              className="btn sec"
              disabled={pending}
            >
              Stop voting now
            </button>
          )}
        </form>

        <div className="managdanger">
          {/* Deleting is refused server-side once anyone has voted: at that point
              the board is their record too, and closing is the honest action. */}
          {hasVotes ? (
            <p className="hint">
              People have voted, so this poll can&apos;t be deleted. Stop voting instead —
              the result stays on the record.
            </p>
          ) : confirmDelete ? (
            <form action={delAction}>
              <input type="hidden" name="poll_id" value={pollId} />
              <p className="hint">This removes the poll and its options. It can&apos;t be undone.</p>
              <div className="qactions">
                <button type="submit" className="btn danger" disabled={delPending}>
                  {delPending ? "Deleting…" : "Delete for good"}
                </button>
                <button type="button" className="btn sec" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button type="button" className="btn danger" onClick={() => setConfirmDelete(true)}>
              Delete poll
            </button>
          )}
          {delState.error && (
            <p className="fielderr" role="alert">
              {delState.error}
            </p>
          )}
        </div>
      </Sheet>
    </>
  );
}
