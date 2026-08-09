import AppShell from "@/components/shell/AppShell";
import { createClient, getUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ProfileEditForm } from "../ProfileEditForm";

export const metadata = { title: "Edit profile · MaxPoll" };

/**
 * Editing your profile is its own screen.
 *
 * It used to be a `#profile` anchor on /settings, which meant the profile page's
 * "Edit profile" and "Settings" buttons went to the same URL with different
 * fragments — indistinguishable once you arrived, and the browser's back button
 * had nothing to go back to. A separate route also means the form is the only
 * thing on screen, which is what a form wants.
 *
 * The three read-only rows sit above the form on purpose: handle, email and DOB
 * are the fields people come here to change and cannot. Saying so up front is
 * shorter than an error afterwards.
 */
export default async function EditProfilePage() {
  const user = await getUser();
  if (!user) redirect("/");

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("handle, display_name, bio, instagram, x_handle, snapchat")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) redirect("/onboarding");

  return (
    <AppShell>
      <div className="setwrap">
        <a className="backlink" href={`/u/${profile.handle}`}>
          ← Back to profile
        </a>

        <h1 className="t-title">Edit profile</h1>

        <section>
          <h2 className="t-label">Can&apos;t be changed</h2>
          <dl className="setlist">
            <div>
              <dt>Handle</dt>
              <dd>@{profile.handle}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>Date of birth</dt>
              {/* Locked after set — it's the 18+ record, not a preference. */}
              <dd className="t-sec">Locked</dd>
            </div>
          </dl>
        </section>

        <section>
          <h2 className="t-label">Your details</h2>
          <ProfileEditForm
            displayName={profile.display_name}
            bio={profile.bio}
            instagram={profile.instagram}
            xHandle={profile.x_handle}
            snapchat={profile.snapchat}
          />
        </section>
      </div>
    </AppShell>
  );
}
