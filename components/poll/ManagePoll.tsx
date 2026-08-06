"use client";

import { useActionState, useState } from "react";
import { Sheet } from "./Sheet";
import { updatePoll, deletePoll, type ManageState } from "@/app/p/[slug]/manage-actions";

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
  hasExpiry,
}: {
  pollId: string;
  slug: string;
  title: string;
  closed: boolean;
  optionsLocked: boolean;
  hasVotes: boolean;
  hasExpiry: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [state, action, pending] = useActionState<ManageState, FormData>(updatePoll, {});
  const [delState, delAction, delPending] = useActionState<ManageState, FormData>(deletePoll, {});

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

          <label className="lbl" htmlFor="m-duration">
            Deadline
          </label>
          <select id="m-duration" name="duration" className="field" defaultValue="keep">
            {/* "keep" and "none" must stay distinct: one leaves the timer alone,
                the other removes it. Collapsing them would silently clear
                someone's deadline every time they fixed a typo. */}
            <option value="keep">Leave as it is{hasExpiry ? "" : " (no timer)"}</option>
            <option value="6h">6 hours from now</option>
            <option value="24h">24 hours from now</option>
            <option value="3d">3 days from now</option>
            <option value="7d">7 days from now</option>
            <option value="none">Remove the deadline</option>
          </select>

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
