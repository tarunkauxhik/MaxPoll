"use client";

import { useState, useTransition } from "react";
import { toggleFollow } from "./actions";

export function FollowButton({
  targetId,
  following,
}: {
  targetId: string;
  following: boolean;
}) {
  const [isFollowing, setFollowing] = useState(following);
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      className={isFollowing ? "btn sec fullw" : "btn pri fullw"}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const next = !isFollowing;
          setFollowing(next);
          await toggleFollow(targetId, next);
        })
      }
    >
      {isFollowing ? "Following" : "Follow"}
    </button>
  );
}
