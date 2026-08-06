"use client";

import { useState } from "react";

/**
 * doc 03 §L. Native share where it exists, copy-link with a toast otherwise.
 * The prefill names the gap when there is one — that line is the growth engine,
 * so the share text carries it rather than a generic "check this out".
 */
export function ShareButton({
  code,
  title,
  leader,
  gap,
}: {
  /** The short code, not the readable slug — both resolve, this one fits on one
   *  line in a group chat. */
  code: string;
  title: string;
  leader: string | null;
  /** Votes between rank 2 and rank 1, when there is a race worth naming. */
  gap: number | null;
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}/p/${code}`;
    // WhatsApp auto-links a bare host, and `viratkohli.tech/p/x` reads better in
    // a group than the same thing with `https://` bolted on the front.
    //
    // Only the *text* loses the scheme. `navigator.share({ url })` requires an
    // absolute URL and rejects one without a protocol, so that field keeps it.
    const pretty = url.replace(/^https?:\/\//, "");
    // The gap is the growth engine — "17 votes behind" is a reason to open the
    // link; "check this out" is not. Falls back to the leader, then to nothing
    // to name at all.
    const text =
      gap !== null && leader
        ? `${leader} is only ${gap} vote${gap === 1 ? "" : "s"} ahead in "${title}" 👇`
        : leader
          ? `${leader} is leading "${title}" 👇`
          : `bhai isme vote kardo 👇`;

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        // User dismissed the sheet. Not an error, and not a reason to then
        // silently copy something to their clipboard.
        return;
      }
    }

    try {
      await navigator.clipboard.writeText(`${text} ${pretty}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link", pretty);
    }
  }

  return (
    <button type="button" className="btn pri" onClick={share}>
      {copied ? "Link copied" : "Share to WhatsApp"}
    </button>
  );
}
