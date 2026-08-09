"use client";

import { useTransition } from "react";
import { signInWithGoogle } from "@/lib/auth-actions";

/**
 * "Log in" and "Sign up" are the same button pointing at the same handler —
 * Google returns the account if it exists and creates it if not. There are no
 * passwords in this product, so no forgot/reset flow exists (RULES.md).
 *
 * `next` survives the round trip so a vote intent lands back on its poll.
 */
export function SignInButton({
  next,
  label = "Continue with Google",
  variant = "pri",
  className,
}: {
  next?: string;
  label?: string;
  variant?: "pri" | "sec";
  /** Full override, for the two landing placements that need `sm` or `fullw`. */
  className?: string;
}) {
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      className={className ?? `btn ${variant}`}
      disabled={pending}
      onClick={() => start(() => signInWithGoogle(next))}
    >
      {pending ? "Opening Google…" : label}
    </button>
  );
}
