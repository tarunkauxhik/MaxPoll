"use client";

import { useActionState } from "react";
import { updateProfile, type ProfileEditState } from "./actions";
import { BIO_MAX } from "@/lib/profile";

export function ProfileEditForm({
  displayName,
  bio,
  instagram,
  xHandle,
  snapchat,
}: {
  displayName: string;
  bio: string | null;
  instagram: string | null;
  xHandle: string | null;
  snapchat: string | null;
}) {
  const [state, action, pending] = useActionState<ProfileEditState, FormData>(
    updateProfile,
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
      <label className="lbl" htmlFor="e-display_name">
        Display name
      </label>
      <input
        id="e-display_name"
        name="display_name"
        className="field"
        defaultValue={displayName}
        maxLength={40}
        required
      />
      {err("display_name")}

      <label className="lbl" htmlFor="e-bio">
        Bio <span className="lbl-opt">optional</span>
      </label>
      <textarea
        id="e-bio"
        name="bio"
        className="field"
        rows={2}
        maxLength={BIO_MAX}
        defaultValue={bio ?? ""}
      />
      {err("bio")}

      <p className="lbl">
        Socials <span className="lbl-opt">optional</span>
      </p>
      <div className="socialgrid">
        <input
          name="instagram"
          className="field"
          placeholder="Instagram"
          defaultValue={instagram ?? ""}
          autoCapitalize="none"
        />
        <input
          name="x_handle"
          className="field"
          placeholder="X"
          defaultValue={xHandle ?? ""}
          autoCapitalize="none"
        />
        <input
          name="snapchat"
          className="field"
          placeholder="Snapchat"
          defaultValue={snapchat ?? ""}
          autoCapitalize="none"
        />
      </div>

      {state.error && !state.field && (
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
    </form>
  );
}
