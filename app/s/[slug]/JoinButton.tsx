"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleMembership } from "@/app/spaces/new/actions";

export function JoinButton({
  spaceId,
  slug,
  joined,
}: {
  spaceId: string;
  slug: string;
  joined: boolean;
}) {
  const [isIn, setIsIn] = useState(joined);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      className={isIn ? "btn sec fullw" : "btn pri fullw"}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const next = !isIn;
          setIsIn(next);
          await toggleMembership(spaceId, slug, next);
          // The member count and the results gate both move, so re-fetch rather
          // than leaving a stale "12/20" on screen.
          router.refresh();
        })
      }
    >
      {pending ? "…" : isIn ? "Leave Space" : "Join Space"}
    </button>
  );
}
