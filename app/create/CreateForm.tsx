"use client";

import { useActionState, useState } from "react";
import { createPoll, type CreateState } from "./actions";
import { ADJECTIVES } from "./adjectives";

export function CreateForm({
  spaces,
  left,
}: {
  spaces: { id: string; name: string }[];
  left: number;
}) {
  const [state, action, pending] = useActionState<CreateState, FormData>(createPoll, {});
  const [subject, setSubject] = useState<"person" | "thing">("person");
  const [options, setOptions] = useState(["", ""]);

  const setOpt = (i: number, v: string) =>
    setOptions((prev) => prev.map((o, j) => (j === i ? v : o)));

  return (
    <form action={action} className="createform">
      <p className={left === 0 ? "fielderr" : "hint"}>
        <span className="num">{left}</span> of <span className="num">3</span> left this week
      </p>

      <label className="lbl" htmlFor="space_id">
        Space
      </label>
      <select id="space_id" name="space_id" className="field" required>
        <option value="">Choose a Space</option>
        {spaces.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>

      <p className="lbl">What&apos;s it about</p>
      <div className="segment" role="group" aria-label="Poll subject">
        <button
          type="button"
          className={subject === "person" ? "on" : ""}
          onClick={() => setSubject("person")}
          aria-pressed={subject === "person"}
        >
          👤 A person
        </button>
        <button
          type="button"
          className={subject === "thing" ? "on" : ""}
          onClick={() => setSubject("thing")}
          aria-pressed={subject === "thing"}
        >
          🎬 A thing
        </button>
      </div>
      <input type="hidden" name="subject_type" value={subject} />

      {subject === "person" ? (
        <>
          <label className="lbl" htmlFor="adjective">
            Question
          </label>
          {/* Preset positive adjectives only — 03-ux-flows D. A free-text
              adjective on a person poll is how this becomes a bullying tool. */}
          <select id="adjective" name="adjective" className="field">
            {ADJECTIVES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <input
            name="scope"
            className="field spaced"
            placeholder="1st year teacher"
            aria-label="Who or what, e.g. 1st year teacher"
            maxLength={60}
          />
        </>
      ) : (
        <>
          <label className="lbl" htmlFor="title">
            Title
          </label>
          <input
            id="title"
            name="title"
            className="field"
            placeholder="Best canteen on campus"
            maxLength={80}
          />
        </>
      )}

      <p className="lbl">Starting options</p>
      {options.map((v, i) => (
        <input
          key={i}
          name="options"
          className="field spaced"
          value={v}
          onChange={(e) => setOpt(i, e.target.value)}
          placeholder={`Option ${i + 1}`}
          maxLength={80}
        />
      ))}
      {options.length < 10 && (
        <button
          type="button"
          className="btn sm sec"
          onClick={() => setOptions((p) => [...p, ""])}
        >
          + Add another
        </button>
      )}
      <p className="hint">Anyone can add more once it&apos;s live.</p>

      <label className="lbl" htmlFor="duration">
        Voting closes in
      </label>
      <select id="duration" name="duration" className="field" defaultValue="24h">
        <option value="6h">6 hours</option>
        <option value="24h">24 hours</option>
        <option value="3d">3 days</option>
        <option value="7d">7 days</option>
        <option value="none">No deadline</option>
      </select>

      {state.error && (
        <p className="fielderr" role="alert">
          {state.error}
        </p>
      )}

      <button type="submit" className="btn pri" disabled={pending || left === 0}>
        {pending ? "Creating…" : "Create poll"}
      </button>
    </form>
  );
}
