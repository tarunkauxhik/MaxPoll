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
import { Emoji } from "@/components/ui/Emoji";

/**
 * The creator's controls — the build plan shipped none, so a poll was permanently
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
        <Emoji char="⚙" /> Manage poll
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
          {/* Closes this sheet as it opens the other. Two stacked dialogs fight
              over the focus trap, and the confirmation is a different question,
              not a step inside this one. */}
          <button
            type="button"
            className="btn danger"
            onClick={() => {
              setOpen(false);
              setConfirmDelete(true);
            }}
          >
            Delete poll
          </button>
        </div>
      </Sheet>

      {/**
       * The consent screen. Its own sheet rather than an inline reveal inside
       * Manage poll: this is now allowed even after people have voted, so it is
       * the one destructive action in the product a creator can reach, and it
       * gets a screen that says what disappears rather than a button that grows
       * a second button.
       *
       * The vote count is in the sentence for the same reason — "4 people have
       * voted" is the cost, and a confirmation that does not name the cost is
       * just a speed bump.
       */}
      <Sheet
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this poll?"
        description={title}
      >
        <p className="hint">
          {hasVotes
            ? "This removes the poll, its options and every vote on it. The people who voted lose it too."
            : "This removes the poll and its options."}{" "}
          It can&apos;t be undone.
        </p>

        <form action={delAction}>
          <input type="hidden" name="poll_id" value={pollId} />
          <button type="submit" className="btn danger sheetcta" disabled={delPending}>
            {delPending ? "Deleting…" : "Delete poll"}
          </button>
        </form>

        <button type="button" className="btn sec" onClick={() => setConfirmDelete(false)}>
          Keep it
        </button>

        {delState.error && (
          <p className="fielderr" role="alert">
            {delState.error}
          </p>
        )}

        {!closed && (
          <p className="hint">
            Only want to stop the voting? Close it from Manage poll instead — the result
            stays on the record.
          </p>
        )}
      </Sheet>
    </>
  );
}
