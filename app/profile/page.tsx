import { redirect } from "next/navigation";
import { getProfile, getUser } from "@/lib/supabase/server";
import AppShell from "@/components/shell/AppShell";
import { EmptyState } from "@/components/ui/States";
import { SignInButton } from "../SignInButton";

/**
 * The nav's Profile tab. Profiles are public and live at /@handle, so this is
 * just the redirect that turns "my profile" into "that person's profile".
 */
export default async function ProfileRedirect() {
  const user = await getUser();
  if (!user) {
    return (
      <AppShell>
        <EmptyState
          icon="👤"
          message="Sign in to see your profile, badges and polls."
          action={<SignInButton next="/profile" />}
        />
      </AppShell>
    );
  }

  const profile = await getProfile();
  if (!profile) redirect("/onboarding");
  redirect(`/@${profile.handle}`);
}
