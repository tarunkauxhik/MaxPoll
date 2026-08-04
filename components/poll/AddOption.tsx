"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { searchOptions, addOption, type Suggestion } from "@/app/p/[slug]/option-actions";
import { signInWithGoogle } from "@/lib/auth-actions";
import { castVote } from "@/app/p/[slug]/actions";
import { getDeviceId } from "@/lib/device";
import { n } from "@/lib/format";
import { similarity } from "@/lib/similarity";

/**
 * doc 04 §5.10 / 03-ux-flows E.
 *
 * The point of the typeahead is not convenience — it's that a duplicate splits
 * the vote and makes the whole board wrong. Showing rank and count makes voting
 * for the existing entry the obvious move.
 */
export function AddOption({
  pollId,
  slug,
  signedIn,
}: {
  pollId: string;
  slug: string;
  signedIn: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [hits, setHits] = useState<Suggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const seq = useRef(0);

  // 250ms debounce (doc 04 §5.10). The guard on `mine` keeps an early, slow
  // response from overwriting a later, faster one — without it, typing "nar" then
  // "narendra" can leave the suggestions for "nar" on screen.
  //
  // Clearing on a too-short query happens in the change handler, not here: a
  // setState in an effect body triggers a cascading render.
  useEffect(() => {
    if (value.trim().length < 2) return;
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      const found = await searchOptions(pollId, value);
      if (mine === seq.current) setHits(found);
    }, 250);
    return () => clearTimeout(t);
  }, [value, pollId]);

  const near = hits.find((h) => similarity(h.label, value) > 0.8);

  function submitNew() {
    if (!signedIn) return signInWithGoogle(`/p/${slug}`);
    start(async () => {
      const res = await addOption(pollId, slug, value);
      if (res.ok) {
        setValue("");
        setHits([]);
        setOpen(false);
        setError(null);
      } else {
        setError(res.message);
      }
    });
  }

  function voteFor(optionId: string) {
    if (!signedIn) return signInWithGoogle(`/p/${slug}`);
    start(async () => {
      await castVote(pollId, optionId, slug, getDeviceId());
      setValue("");
      setHits([]);
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <button type="button" className="btn sec addopen" onClick={() => setOpen(true)}>
        + Add someone missing
      </button>
    );
  }

  return (
    <div className="addwrap">
      <label className="lbl" htmlFor="addopt">
        Add someone
      </label>
      <input
        id="addopt"
        className="field"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          // Stale suggestions must not linger under an emptied field.
          if (e.target.value.trim().length < 2) setHits([]);
        }}
        placeholder="Type a name"
        maxLength={80}
        autoFocus
        autoComplete="off"
      />

      {near && (
        <div className="dupewarn" role="alert">
          <p>
            Looks like <b>{near.label}</b> is already here. Vote for the existing one so
            the count isn&apos;t split.
          </p>
          <button type="button" className="btn sm pri" onClick={() => voteFor(near.id)}>
            Vote for {near.label}
          </button>
          <button type="button" className="btn sm sec dim" onClick={submitNew} disabled={pending}>
            Add as new anyway
          </button>
        </div>
      )}

      {!near && hits.length > 0 && (
        <ul className="sugg">
          {hits.map((h) => (
            <li key={h.id}>
              <button type="button" onClick={() => voteFor(h.id)}>
                <span className="nm">{h.label}</span>
                <span className="rankpill num">#{h.rank}</span>
                <span className="cnt">
                  <span className="num">{n(h.vote_count)}</span> votes
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="fielderr" role="alert">
          {error}
        </p>
      )}

      {!near && (
        <div className="addactions">
          <button
            type="button"
            className="btn pri"
            onClick={submitNew}
            disabled={pending || value.trim().length < 2}
          >
            {pending ? "Adding…" : "Add to poll"}
          </button>
          <button type="button" className="btn sec" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
