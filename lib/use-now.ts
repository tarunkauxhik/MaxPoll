"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * The wall clock as an external store.
 *
 * The obvious version — `useState` + `useEffect` + `setInterval` — needs a
 * `mounted` flag to avoid a hydration mismatch, and setting that flag is a
 * setState inside an effect body, which cascades renders. `useSyncExternalStore`
 * is what React provides for exactly this: a mutable source outside React.
 *
 * `getServerSnapshot` returns a caller-supplied fixed instant so the SSR HTML is
 * deterministic and the first client paint matches it.
 */
export function useNow(serverNow: number, intervalMs = 1000): number {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const id = setInterval(onChange, intervalMs);
      return () => clearInterval(id);
    },
    [intervalMs]
  );

  return useSyncExternalStore(
    subscribe,
    // Floored to the interval so repeated calls within one tick return an
    // identical value — React requires getSnapshot to be stable between renders.
    () => Math.floor(Date.now() / intervalMs) * intervalMs,
    () => serverNow
  );
}
