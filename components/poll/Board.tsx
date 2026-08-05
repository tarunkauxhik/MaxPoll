"use client";

import { useEffect, useRef, useState, useTransition, useCallback } from "react";
import OptionRow from "@/components/ui/OptionRow";
import { Sheet } from "./Sheet";
import { castVote, joinSpace } from "@/app/p/[slug]/actions";
import { signInWithGoogle } from "@/lib/auth-actions";
import { saveIntent, takeIntent } from "@/lib/vote-intent";
import { getDeviceId } from "@/lib/device";
import { gapAbove, type BoardOption } from "@/lib/rank";
import { n } from "@/lib/format";

const TOP_N = 5;

export function Board({
  pollId,
  slug,
  initial,
  myOptionId,
  entitled,
  isMember,
  spaceId,
  spaceName,
  spaceMembers,
  signedIn,
  closed,
  resultsLocked = false,
}: {
  pollId: string;
  slug: string;
  initial: BoardOption[];
  myOptionId: string | null;
  entitled: boolean;
  isMember: boolean;
  spaceId: string | null;
  spaceName: string | null;
  spaceMembers: number;
  signedIn: boolean;
  closed: boolean;
  /** Space under 20 members — 03 §C. Hides the numbers, never the ballot. */
  resultsLocked?: boolean;
}) {
  const [board, setBoard] = useState(initial);
  const [mine, setMine] = useState(myOptionId);
  const [pendingOption, setPendingOption] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);
  const positions = useRef(new Map<string, number>());

  const voted = mine !== null;
  /**
   * Voting and *seeing* are two different unlocks. `voted` still governs whether
   * you can tap; this governs whether numbers appear. Under the 20-member gate
   * you vote normally and the board stays blank — which is the point of the gate.
   */
  const showCounts = voted && !resultsLocked;

  // ── Polling ────────────────────────────────────────────────────────────────
  // 4s active, 10s hidden, and nothing at all on a closed poll — a closed board
  // cannot change, so polling it is pure spend against the free tier.
  const refresh = useCallback(async () => {
    try {
      const r = await fetch(`/api/poll/${pollId}/board`, { cache: "no-store" });
      if (!r.ok) return;
      const data = (await r.json()) as { options: BoardOption[] };
      setBoard(data.options);
    } catch {
      // A dropped poll is not an error state — the next tick retries.
    }
  }, [pollId]);

  const submit = useCallback(
    (optionId: string) => {
      startTransition(async () => {
        const res = await castVote(pollId, optionId, slug, getDeviceId());
        if (res.ok) {
          setMine(optionId);
          setError(null);
          refresh();
        } else if (res.code === "ALREADY_VOTED") {
          // Not an error the user should see: the vote they wanted exists.
          setMine((cur) => cur ?? optionId);
          setError(null);
        } else {
          setError(res.message);
        }
      });
    },
    [pollId, slug, refresh]
  );

  // ── Vote-intent replay (build plan 4.4) ────────────────────────────────────
  // The user tapped an option, was sent to Google, and came back. The vote must
  // land on the option they originally tapped. Runs once, on mount, only when
  // signed in — otherwise the intent stays in storage for the next return.
  useEffect(() => {
    if (!signedIn || closed) return;
    const intent = takeIntent(localStorage, pollId);
    if (intent) submit(intent.optionId);
  }, [signedIn, closed, pollId, submit]);

  useEffect(() => {
    if (closed) return;
    let id: ReturnType<typeof setInterval>;
    const start = () => {
      clearInterval(id);
      id = setInterval(refresh, document.hidden ? 10_000 : 4_000);
    };
    start();
    document.addEventListener("visibilitychange", start);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", start);
    };
  }, [closed, refresh]);

  // ── FLIP (doc 04 §7 — the one signature motion) ────────────────────────────
  // Measure before paint, then animate the delta. Only transform is animated;
  // animating `top` would trigger layout on every frame on a budget Android.
  useEffect(() => {
    const root = listRef.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    root.querySelectorAll<HTMLElement>("[data-opt]").forEach((el) => {
      const id = el.dataset.opt!;
      const prev = positions.current.get(id);
      const next = el.getBoundingClientRect().top;
      if (prev !== undefined && prev !== next) {
        el.animate(
          [{ transform: `translateY(${prev - next}px)` }, { transform: "translateY(0)" }],
          { duration: 340, easing: "cubic-bezier(.22,1,.36,1)" }
        );
      }
      positions.current.set(id, next);
    });
  }, [board]);

  function onSelect(optionId: string) {
    if (closed || voted) return;
    setError(null);

    if (!signedIn) {
      // Written BEFORE the redirect. This ordering is the whole fix.
      saveIntent(localStorage, { pollId, optionId });
      signInWithGoogle(`/p/${slug}`);
      return;
    }
    if (spaceId && !isMember) {
      setPendingOption(optionId);
      return;
    }
    submit(optionId);
  }

  const top = board.slice(0, TOP_N);
  const under = board.slice(TOP_N);
  // The gap line spells out a vote count ("17 votes behind"), so it is a result
  // like any other and cannot leak past the gate.
  const gap = resultsLocked ? null : gapAbove(board, mine);

  return (
    <>
      {/* aria-live so rank changes are announced rather than silently redrawn */}
      <div className="board" ref={listRef} aria-live="polite">
        {top.map((o) => (
          <div key={o.id} data-opt={o.id}>
            <OptionRow
              rank={o.rank}
              label={o.label}
              votes={showCounts ? o.votes : undefined}
              pct={showCounts ? o.pct : undefined}
              movement={showCounts ? o.movement : undefined}
              mine={o.id === mine}
              onSelect={() => onSelect(o.id)}
              disabled={closed || voted}
            />
            {gap && o.id === mine && (
              <p className="gap">
                ↑ <b className="num">{n(gap.need)} votes</b> behind {gap.target}. Share to
                close the gap.
              </p>
            )}
          </div>
        ))}
      </div>

      {error && (
        <p className="fielderr boarderr" role="alert">
          {error}
        </p>
      )}

      {!voted && !closed && (
        <p className="hint lcenter">Tap a name to vote</p>
      )}

      {under.length > 0 && (
        <UnderList
          options={under}
          showCounts={showCounts}
          entitled={entitled}
          mine={mine}
          slug={slug}
        />
      )}

      <Sheet
        open={pendingOption !== null}
        onOpenChange={(v) => !v && setPendingOption(null)}
        title={`Join ${spaceName ?? "this Space"}`}
        description={`${n(spaceMembers)} members`}
      >
        <p className="discl sheetdiscl">
          <span aria-hidden="true">🔓</span>
          <span>Votes on MaxPoll are public. Your name will be visible on this poll.</span>
        </p>
        <button
          type="button"
          className="btn pri sheetcta"
          onClick={() => {
            const opt = pendingOption!;
            setPendingOption(null);
            submit(opt);
          }}
        >
          Join {spaceName ?? "Space"} &amp; cast my vote
        </button>
        <button
          type="button"
          className="btn sec"
          onClick={() => {
            if (spaceId) joinSpace(spaceId, slug);
            setPendingOption(null);
          }}
        >
          Just join, don&apos;t vote yet
        </button>
      </Sheet>
    </>
  );
}

/**
 * Ranks 6+. Counts are hidden until the user has voted, and hidden again behind
 * the paywall — but **the labels here are real**. What the unpaid user cannot see
 * is voter *names*, and those never reach the client at all: RLS refuses them,
 * so there is nothing in the payload to un-blur.
 */
function UnderList({
  options,
  showCounts,
  entitled,
  mine,
  slug,
}: {
  options: BoardOption[];
  showCounts: boolean;
  entitled: boolean;
  mine: string | null;
  slug: string;
}) {
  return (
    <>
      <div className="t-label underlbl">Everyone else</div>
      <div className="board">
        {options.map((o) => (
          <OptionRow
            key={o.id}
            rank={o.rank}
            label={o.label}
            votes={showCounts && entitled ? o.votes : undefined}
            pct={showCounts && entitled ? o.pct : undefined}
            mine={o.id === mine}
            variant="small"
            disabled
          />
        ))}
      </div>
      {/* `showCounts`, not `voted`: under the 20-member gate there are no results
          to reveal, so ₹9 would buy a board that stays blank. Never offer a
          purchase that cannot deliver. */}
      {showCounts && !entitled && (
        <a className="btn vio unlockcta" href={`/p/${slug}/unlock`}>
          See the exact names of voters · ₹9
        </a>
      )}
    </>
  );
}
