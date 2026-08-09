"use client";

import { useActionState, useState } from "react";
import { Sheet } from "@/components/poll/Sheet";
import { deleteSpace, type SpaceManageState } from "./manage-actions";
import { Emoji } from "@/components/ui/Emoji";

/**
 * The Space creator's one control: delete.
 *
 * Rendered only for the owner, but that is presentation — `delete_space()` takes
 * identity from `auth.uid()`, so hiding this button is not what stops anyone
 * else.
 *
 * `polls.space_id` is `on delete cascade`, so this takes every poll in the Space
 * with it. That is why the button is refused up front once somebody else has
 * posted here: their board is not the Space owner's to remove. The database
 * refuses it too — this is the explanation, not the guard.
 */
export function ManageSpace({
  spaceId,
  name,
  ownPolls,
  otherPolls,
  members,
}: {
  spaceId: string;
  name: string;
  /** Polls in this Space created by the person looking at it. */
  ownPolls: number;
  /** Polls created by anyone else. Non-zero means delete is refused. */
  otherPolls: number;
  members: number;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<SpaceManageState, FormData>(
    deleteSpace,
    {}
  );

  const blocked = otherPolls > 0;

  return (
    <>
      <button type="button" className="btn danger" onClick={() => setOpen(true)}>
        <Emoji char="🗑" /> Delete Space
      </button>

      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={blocked ? "This Space can't be deleted" : `Delete ${name}?`}
        description={
          blocked ? undefined : `${members} ${members === 1 ? "member" : "members"}`
        }
      >
        {blocked ? (
          <>
            <p className="hint">
              Other people have posted{" "}
              <b className="num">{otherPolls}</b>{" "}
              {otherPolls === 1 ? "poll" : "polls"} here. Those boards belong to the
              people who made them and to everyone who voted on them, so deleting this
              Space would take something that isn&apos;t yours.
            </p>
            <button type="button" className="btn sec" onClick={() => setOpen(false)}>
              Got it
            </button>
          </>
        ) : (
          <>
            <p className="hint">
              {ownPolls > 0 ? (
                <>
                  This deletes the Space and{" "}
                  <b className="num">{ownPolls}</b> {ownPolls === 1 ? "poll" : "polls"} you
                  made in it, along with every vote on{" "}
                  {ownPolls === 1 ? "it" : "them"}.
                </>
              ) : (
                <>This Space has no polls in it.</>
              )}{" "}
              It can&apos;t be undone.
            </p>

            <form action={action}>
              <input type="hidden" name="space_id" value={spaceId} />
              <button type="submit" className="btn danger sheetcta" disabled={pending}>
                {pending ? "Deleting…" : "Delete Space"}
              </button>
            </form>

            <button type="button" className="btn sec" onClick={() => setOpen(false)}>
              Keep it
            </button>
          </>
        )}

        {state.error && (
          <p className="fielderr" role="alert">
            {state.error}
          </p>
        )}
      </Sheet>
    </>
  );
}
