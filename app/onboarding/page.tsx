import { createClient } from "@/lib/supabase/server";
import { suggestHandle } from "@/lib/profile";
import { redirect } from "next/navigation";
import { OnboardingForm } from "./OnboardingForm";
import { Emoji } from "@/components/ui/Emoji";

export const metadata = { title: "Set up your profile · MaxPoll" };

export default async function OnboardingPage({
  searchParams,
}: {
  // Next 16: searchParams is a Promise.
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  // Already onboarded — don't let them create a second profile.
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (existing) redirect(next ?? "/");

  const googleName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    "";

  return (
    <main className="shell-col onbwrap">
      <h1 className="t-title">Almost there</h1>
      <p className="t-sec onbsub">
        This is how you&apos;ll show up on every poll you vote in.
      </p>
      <OnboardingForm
        suggestedHandle={suggestHandle(googleName)}
        suggestedName={googleName}
        next={next && next.startsWith("/") ? next : "/"}
      />
      <p className="discl">
        <Emoji char="🔓" />
        <span>
          Votes on MaxPoll are public. Your name will be visible on polls you vote in.
        </span>
      </p>
    </main>
  );
}
