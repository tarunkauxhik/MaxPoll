"use client";

import { useState } from "react";

/**
 * doc 03 §L. Native share where it exists, copy-link with a toast otherwise.
 *
 * The shared text is exactly `${text} : ${prettyUrl}` — nothing else. No
 * title, no gap/leader framing: those used to be baked in here, but the
 * owner asked for the plain form specifically, so this component doesn't
 * invent anything beyond what's passed in.
 */
export function ShareButton({
  path,
  text,
}: {
  /** Site-relative, e.g. `/p/j6ev26t` or `/s/dtu-8x2f`. */
  path: string;
  /** Everything before the " : ", e.g. "your pov matters". */
  text: string;
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}${path}`;
    // WhatsApp auto-links a bare host, and `viratkohli.tech/p/x` reads better
    // in a group than the same thing with `https://` bolted on the front.
    // Only the *text* loses the scheme — `navigator.share({ url })` would
    // need the real absolute URL, so this never passes `url` at all; the
    // pretty form is embedded directly in `text` instead.
    const pretty = url.replace(/^https?:\/\//, "");
    const full = `${text} : ${pretty}`;

    if (navigator.share) {
      try {
        await navigator.share({ text: full });
        return;
      } catch {
        // User dismissed the sheet. Not an error, and not a reason to then
        // silently copy something to their clipboard.
        return;
      }
    }

    try {
      await navigator.clipboard.writeText(full);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link", pretty);
    }
  }

  return (
    <button type="button" className="btn pri" onClick={share}>
      {!copied && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12.04 2c-5.52 0-10 4.48-10 10 0 1.77.46 3.5 1.34 5.02L2 22l5.13-1.35a9.96 9.96 0 0 0 4.91 1.29h.01c5.52 0 10-4.48 10-10s-4.49-9.94-10.01-9.94Zm0 18.1a8.2 8.2 0 0 1-4.18-1.14l-.3-.18-3.05.8.81-2.97-.2-.31a8.22 8.22 0 0 1-1.26-4.4c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.55-3.7 8.2-8.31 8.2Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.17.24-.64.8-.78.97-.15.16-.29.18-.54.06-.25-.12-1.04-.38-1.99-1.22-.73-.65-1.23-1.46-1.37-1.7-.15-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.13-.15.17-.25.25-.41.08-.17.04-.31-.02-.44-.06-.12-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.87.85-.87 2.08 0 1.22.89 2.4 1.02 2.57.12.16 1.75 2.67 4.24 3.74.59.26 1.05.41 1.41.53.59.19 1.13.16 1.55.1.47-.07 1.47-.6 1.68-1.18.2-.58.2-1.08.14-1.18-.06-.1-.22-.16-.47-.28Z" />
        </svg>
      )}
      {copied ? "Link copied" : "Share to WhatsApp"}
    </button>
  );
}
