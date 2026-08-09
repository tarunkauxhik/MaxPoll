"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { sendMessage } from "@/app/p/[slug]/chat/actions";
import { signInWithGoogle } from "@/lib/auth-actions";
import { cn } from "@/lib/cn";

export type Message = {
  id: number;
  body: string;
  anon_handle: string | null;
  user_id: string | null;
  created_at: string;
};

export function Chat({
  pollId,
  initial,
  myId,
  signedIn,
  slug,
  readOnly,
}: {
  pollId: string;
  initial: Message[];
  myId: string | null;
  signedIn: boolean;
  slug: string;
  readOnly: boolean;
}) {
  const [messages, setMessages] = useState(initial);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);
  const lastId = useRef(initial.at(-1)?.id ?? 0);

  const poll = useCallback(async () => {
    try {
      const r = await fetch(`/api/poll/${pollId}/messages?since=${lastId.current}`, {
        cache: "no-store",
      });
      if (!r.ok) return;
      const { messages: fresh } = (await r.json()) as { messages: Message[] };
      if (fresh.length === 0) return;
      lastId.current = fresh.at(-1)!.id;
      setMessages((prev) => [...prev, ...fresh]);
    } catch {
      /* next tick retries */
    }
  }, [pollId]);

  useEffect(() => {
    // Closed polls are read-only, so there is nothing to poll for.
    if (readOnly) return;
    let id: ReturnType<typeof setInterval>;
    const start_ = () => {
      clearInterval(id);
      id = setInterval(poll, document.hidden ? 15_000 : 3_000);
    };
    start_();
    document.addEventListener("visibilitychange", start_);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", start_);
    };
  }, [poll, readOnly]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  function send(e: React.FormEvent) {
    e.preventDefault();
    if (!signedIn) return signInWithGoogle(`/p/${slug}/chat`);
    const text = body.trim();
    if (!text) return;

    start(async () => {
      const res = await sendMessage(pollId, text);
      if (res.ok) {
        setBody("");
        setError(null);
        poll();
      } else {
        setError(res.message);
      }
    });
  }

  return (
    <div className="chat">
      <div className="bubbles">
        {messages.length === 0 && (
          <p className="hint lcenter">No messages yet. Say something.</p>
        )}
        {messages.map((m) => {
          const mine = myId !== null && m.user_id === myId;
          return (
            <div key={m.id} className={cn("bub", mine ? "me" : "them")}>
              <span className={cn("who", m.anon_handle && "anon")}>
                {mine ? "You" : m.anon_handle ? `anon · ${m.anon_handle}` : "Someone"}
              </span>
              {m.body}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {error && (
        <p className="fielderr" role="alert">
          {error}
        </p>
      )}

      {readOnly ? (
        <p className="hint lcenter composer">This poll is closed. Chat is read-only.</p>
      ) : (
        <>
          <p className="hint chatanon">
            You&apos;re anonymous here.
          </p>
          <form className="composer" onSubmit={send}>
            <input
              className="field"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Say something"
              maxLength={300}
              aria-label="Message"
            />
            <button type="submit" className="btn sm pri" disabled={pending || !body.trim()}>
              Send
            </button>
          </form>
        </>
      )}
    </div>
  );
}
