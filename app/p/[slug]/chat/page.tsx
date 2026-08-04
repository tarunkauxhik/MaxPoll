import { notFound } from "next/navigation";
import AppShell from "@/components/shell/AppShell";
import { Chat } from "@/components/poll/Chat";
import { getPollBySlug, isExpired } from "@/lib/poll-queries";
import { createClient, getUser } from "@/lib/supabase/server";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const poll = await getPollBySlug(slug);
  return { title: poll ? `Chat · ${poll.title}` : "Chat · MaxPoll" };
}

export default async function ChatPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const poll = await getPollBySlug(slug);
  if (!poll || poll.status === "removed") notFound();

  const user = await getUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from("messages")
    .select("id, body, anon_handle, user_id, created_at")
    .eq("poll_id", poll.id)
    .eq("hidden", false)
    .order("id", { ascending: false })
    .limit(50);

  const closed = isExpired(poll);

  return (
    <AppShell>
      <div className="feed chathead">
        <a className="t-label spacelink" href={`/p/${poll.slug}`}>
          ← {poll.title}
        </a>
      </div>
      <Chat
        pollId={poll.id}
        initial={(data ?? []).slice().reverse()}
        myId={user?.id ?? null}
        signedIn={!!user}
        slug={poll.slug}
        readOnly={closed}
      />
    </AppShell>
  );
}
