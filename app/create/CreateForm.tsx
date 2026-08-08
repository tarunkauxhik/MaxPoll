"use client";

import { useActionState, useState } from "react";
import { createPoll, type CreateState } from "./actions";
import { ADJECTIVES } from "./adjectives";
import { DeadlinePicker } from "@/components/poll/DeadlinePicker";
import { startOrder } from "@/app/pay/actions";
import { PRICES, rupees, type PaymentMode } from "@/lib/payments";
import { cn } from "@/lib/cn";
import { Emoji } from "@/components/ui/Emoji";

export function CreateForm({
  spaces,
  left,
  hasPass,
  mode,
}: {
  spaces: { id: string; name: string }[];
  left: number;
  /** An active 30-day pass lifts the 3-per-week cap — checked in create_poll(). */
  hasPass: boolean;
  mode: PaymentMode;
}) {
  const [state, action, pending] = useActionState<CreateState, FormData>(createPoll, {});
  const [subject, setSubject] = useState<"person" | "thing">("person");
  const [adjective, setAdjective] = useState("");
  const [options, setOptions] = useState(["", ""]);

  const setOpt = (i: number, v: string) =>
    setOptions((prev) => prev.map((o, j) => (j === i ? v : o)));

  return (
    <form action={action} className="createform">
      <div className="quota">
        {hasPass ? (
          <p className="quota-pass">
            <Emoji char="✨" /> Pass active · unlimited polls
          </p>
        ) : (
          <>
            <p className="quota-line">
              <span className="num">{left}</span> of <span className="num">3</span> polls left
              this week
            </p>
            <div className={cn("quotabar", left === 0 && "full")}>
              <i style={{ width: `${((3 - left) / 3) * 100}%` }} />
            </div>
            <p className="hint">Resets 7 days after your first poll.</p>
          </>
        )}

        {!hasPass && mode !== "coming_soon" && (
          <button
            type="submit"
            formAction={startOrder.bind(null, "pass_30d", null, undefined)}
            formNoValidate
            className={cn("quotacta", left === 0 && "pri")}
          >
            <span>
              Unlimited polls + see every voter · ₹
              <span className="num">{rupees(PRICES.pass_30d)}</span> for 30 days
            </span>
            <span aria-hidden="true">→</span>
          </button>
        )}
      </div>

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
          <Emoji char="👤" /> A person
        </button>
        <button
          type="button"
          className={subject === "thing" ? "on" : ""}
          onClick={() => setSubject("thing")}
          aria-pressed={subject === "thing"}
        >
          <Emoji char="🎬" /> A thing
        </button>
      </div>
      <input type="hidden" name="subject_type" value={subject} />

      {subject === "person" ? (
        <>
          <label className="lbl" htmlFor="adjective">
            Question
          </label>
          {/* Free-text now — DECISIONS D10. Presets are one-tap suggestions
              underneath rather than the only option. */}
          <input
            id="adjective"
            name="adjective"
            className="field"
            placeholder="Write your own…"
            value={adjective}
            onChange={(e) => setAdjective(e.target.value)}
            maxLength={40}
          />
          <div className="suggchips">
            {ADJECTIVES.map((a) => (
              <button
                key={a}
                type="button"
                className={cn("suggchip", adjective === a && "on")}
                aria-pressed={adjective === a}
                onClick={() => setAdjective(a)}
              >
                {a}
              </button>
            ))}
          </div>
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

      <p className="lbl">Voting closes in</p>
      <DeadlinePicker />

      {state.error && (
        <p className="fielderr" role="alert">
          {state.error}
        </p>
      )}

      <button type="submit" className="btn pri" disabled={pending || (left === 0 && !hasPass)}>
        {pending ? "Creating…" : "Create poll"}
      </button>
    </form>
  );
}
