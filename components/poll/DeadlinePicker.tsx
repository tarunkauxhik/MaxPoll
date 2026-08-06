"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { toLocalInput } from "@/lib/format";
import { Emoji } from "@/components/ui/Emoji";

type Mode = "keep" | "quick" | "pick" | "none";

/**
 * Emits ONE hidden field, `expires_at`, as an absolute ISO string — or the
 * sentinel `none` for "no deadline", or `keep` for "leave it alone" (Manage
 * poll only). Both callers pass it straight through, so the two screens
 * cannot drift apart on how a deadline is expressed.
 *
 * `keep` and `none` stay distinct on purpose: one leaves the timer alone, the
 * other clears it. Collapsing them would silently wipe someone's deadline
 * every time they fixed a typo in the title.
 *
 * Native inputs, zero dependencies — `datetime-local` opens the real OS
 * picker on a phone, which beats any JS component for this.
 */
export function DeadlinePicker({
  name = "expires_at",
  current = null,
  allowKeep = false,
}: {
  name?: string;
  current?: string | null;
  allowKeep?: boolean;
}) {
  const [mode, setMode] = useState<Mode>(allowKeep ? "keep" : "quick");
  const [hours, setHours] = useState(24);
  // Date.now() cannot run during render — React's purity lint rejects it, and
  // sees through a plain call even wrapped in a promise. A useState lazy
  // initializer is the sanctioned escape hatch: it still runs once per mount,
  // but outside the render body the lint inspects.
  const [now] = useState(() => Date.now());
  const [pickValue, setPickValue] = useState(() => toLocalInput(new Date(now + 24 * 3600e3)));

  const value =
    mode === "keep"
      ? "keep"
      : mode === "none"
        ? "none"
        : mode === "quick"
          ? new Date(now + hours * 3600e3).toISOString()
          : pickValue
            ? new Date(pickValue).toISOString()
            : "";

  const minPick = toLocalInput(new Date(now + 5 * 60e3));
  const maxPick = toLocalInput(new Date(now + 7 * 24 * 3600e3));

  return (
    <div className="deadline">
      <input type="hidden" name={name} value={value} />

      <div className="segment" role="group" aria-label="Voting closes in">
        {allowKeep && (
          <button
            type="button"
            className={mode === "keep" ? "on" : ""}
            aria-pressed={mode === "keep"}
            onClick={() => setMode("keep")}
          >
            Leave as it is
          </button>
        )}
        <button
          type="button"
          className={mode === "quick" ? "on" : ""}
          aria-pressed={mode === "quick"}
          onClick={() => setMode("quick")}
        >
          <Emoji char="⏱" /> Quick
        </button>
        <button
          type="button"
          className={mode === "pick" ? "on" : ""}
          aria-pressed={mode === "pick"}
          onClick={() => setMode("pick")}
        >
          <Emoji char="📅" /> Pick
        </button>
        <button
          type="button"
          className={mode === "none" ? "on" : ""}
          aria-pressed={mode === "none"}
          onClick={() => setMode("none")}
        >
          ∞ None
        </button>
      </div>

      {mode === "quick" && (
        <div className="dquick">
          <input
            type="range"
            className="drange"
            min={1}
            max={24}
            step={1}
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            aria-label="Hours until voting closes"
          />
          <p className="dquick-val">
            <span className="num">{hours}</span> hour{hours === 1 ? "" : "s"} from now
          </p>
          <div className="btnrow">
            {[6, 12, 24].map((h) => (
              <button
                key={h}
                type="button"
                className={cn("btn sm sec", hours === h && "on")}
                onClick={() => setHours(h)}
              >
                +{h}h
              </button>
            ))}
          </div>
        </div>
      )}

      {mode === "pick" && (
        <input
          type="datetime-local"
          className="field"
          value={pickValue}
          min={minPick}
          max={maxPick}
          onChange={(e) => setPickValue(e.target.value)}
          aria-label="Exact date and time voting closes"
        />
      )}

      {mode === "none" && <p className="hint">Voting stays open until you close it yourself.</p>}
      {allowKeep && mode === "keep" && (
        <p className="hint">{current ? "Deadline unchanged." : "No deadline is set."}</p>
      )}
    </div>
  );
}
