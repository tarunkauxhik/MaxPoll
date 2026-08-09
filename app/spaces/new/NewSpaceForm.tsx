"use client";

import { useActionState } from "react";
import { createSpace, type SpaceState } from "./actions";

export function NewSpaceForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<SpaceState, FormData>(createSpace, {});

  // `.onb` is the stacked-form shape — label, field, label, field, one primary
  // action lifted off the last row. This form was the only one without it, so
  // its Create button sat flush against the hint above it.
  return (
    <form className="onb" action={action}>
      {next && <input type="hidden" name="next" value={next} />}

      <label className="lbl" htmlFor="name">
        Name
      </label>
      <input id="name" name="name" className="field" placeholder="DTU · 1st year" maxLength={50} required />

      <label className="lbl" htmlFor="description">
        Description
      </label>
      <textarea
        id="description"
        name="description"
        className="field"
        rows={3}
        maxLength={200}
        placeholder="First-year students at Delhi Technological University."
        required
      />
      <p className="hint">Required. It&apos;s how people tell real Spaces from fakes.</p>

      {state.error && (
        <p className="fielderr" role="alert">
          {state.error}
        </p>
      )}

      <button type="submit" className="btn pri fullw" disabled={pending}>
        {pending ? "Creating…" : "Create Space"}
      </button>
    </form>
  );
}
