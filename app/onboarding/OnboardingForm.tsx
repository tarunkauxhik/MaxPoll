"use client";

import { useActionState } from "react";
import { completeOnboarding, type OnboardingState } from "./actions";
import { BIO_MAX } from "@/lib/profile";

export function OnboardingForm({
  suggestedHandle,
  suggestedName,
  next,
}: {
  suggestedHandle: string;
  suggestedName: string;
  next: string;
}) {
  const [state, action, pending] = useActionState<OnboardingState, FormData>(
    completeOnboarding,
    {}
  );

  const err = (field: string) =>
    state.field === field ? (
      <p className="fielderr" role="alert">
        {state.error}
      </p>
    ) : null;

  return (
    <form action={action} className="onb">
      <input type="hidden" name="next" value={next} />

      <label className="lbl" htmlFor="handle">
        Handle
      </label>
      <div className="handlewrap">
        <span aria-hidden="true">@</span>
        <input
          id="handle"
          name="handle"
          className="field"
          defaultValue={suggestedHandle}
          maxLength={20}
          required
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-describedby="handle-hint"
        />
      </div>
      <p className="hint" id="handle-hint">
        Your profile lives at maxpoll.vercel.app/@handle
      </p>
      {err("handle")}

      <label className="lbl" htmlFor="display_name">
        Display name
      </label>
      <input
        id="display_name"
        name="display_name"
        className="field"
        defaultValue={suggestedName}
        maxLength={40}
        required
      />
      {err("display_name")}

      <label className="lbl" htmlFor="dob">
        Date of birth
      </label>
      {/* Native date input: no picker library, correct on every mobile keyboard,
          and it is the platform's own control — ponytail rung 4. */}
      <input id="dob" name="dob" type="date" className="field" required />
      <p className="hint">MaxPoll is 18+. Never shown on your profile.</p>
      {err("dob")}

      <label className="lbl" htmlFor="bio">
        Bio <span className="lbl-opt">optional</span>
      </label>
      <textarea id="bio" name="bio" className="field" rows={2} maxLength={BIO_MAX} />
      {err("bio")}

      <p className="lbl">
        Socials <span className="lbl-opt">optional</span>
      </p>
      <div className="socialgrid">
        <input name="instagram" className="field" placeholder="Instagram" autoCapitalize="none" />
        <input name="x_handle" className="field" placeholder="X" autoCapitalize="none" />
        <input name="snapchat" className="field" placeholder="Snapchat" autoCapitalize="none" />
      </div>

      {state.error && !state.field && (
        <p className="fielderr" role="alert">
          {state.error}
        </p>
      )}

      <button type="submit" className="btn pri" disabled={pending}>
        {pending ? "Creating…" : "Create my profile"}
      </button>
    </form>
  );
}
