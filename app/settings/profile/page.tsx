import AppShell from "@/components/shell/AppShell";
import { createClient, getUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ProfileEditForm } from "../ProfileEditForm";

export const metadata = { title: "Edit profile · MaxPoll" };

/**
 * `2004-05-12` → `12 May 2004`. The `T00:00:00` is load-bearing: `new Date()` on
 * a bare date string parses it as UTC midnight, which renders as the day before
 * anywhere west of Greenwich — and Vercel's runtime clock is UTC.
 */
const birthday = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

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
  const [{ data: profile }, { data: dob }] = await Promise.all([
    supabase
      .from("profiles")
      .select("handle, display_name, bio, instagram, x_handle, snapchat")
      .eq("id", user.id)
      .maybeSingle(),
    // Not a column on the select above: `select` on profiles.dob is revoked from
    // every client role, because profiles_read is `using (true)` and a grant
    // cannot say "your own row only". `my_dob()` reads auth.uid() itself.
    supabase.rpc("my_dob"),
  ]);

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
              {/* Shown, not editable — it is the 18+ record, not a preference.
                  It used to read "Locked", which told you nothing and left no way
                  to check what was actually on file. */}
              <dd>{dob ? birthday(dob) : "—"}</dd>
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
