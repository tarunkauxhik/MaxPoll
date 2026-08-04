import AppShell from "@/components/shell/AppShell";
import { createClient, getUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { signOut } from "@/lib/auth-actions";
import { DeleteAccount } from "./DeleteAccount";
import { n } from "@/lib/format";
import { activePass } from "@/lib/poll-queries";

export const metadata = { title: "Settings · MaxPoll" };

export default async function SettingsPage() {
  const user = await getUser();
  if (!user) redirect("/");

  const supabase = await createClient();
  const [{ data: profile }, { data: spaces }, { pass, total }] = await Promise.all([
    supabase.from("profiles").select("handle, display_name, bio").eq("id", user.id).maybeSingle(),
    supabase.from("space_members").select("spaces(id, slug, name)").eq("user_id", user.id),
    activePass(user.id),
  ]);

  if (!profile) redirect("/onboarding");

  const joined = (spaces ?? []).flatMap(
    (m: { spaces: { id: string; slug: string; name: string } | { id: string; slug: string; name: string }[] | null }) =>
      m.spaces ? (Array.isArray(m.spaces) ? m.spaces : [m.spaces]) : []
  );

  return (
    <AppShell>
      <div className="setwrap">
        <h1 className="t-title">Settings</h1>

        <section>
          <h2 className="t-label">Account</h2>
          <dl className="setlist">
            <div>
              <dt>Handle</dt>
              <dd>@{profile.handle}</dd>
            </div>
            <div>
              <dt>Name</dt>
              <dd>{profile.display_name}</dd>
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
          <h2 className="t-label">Access</h2>
          <p className="t-sec">
            {pass
              ? `30-day pass active${
                  pass.expires_at
                    ? ` until ${new Date(pass.expires_at).toLocaleDateString("en-IN")}`
                    : ""
                }.`
              : "No pass. Unlocks are per poll."}
          </p>
          <p className="hint">
            <span className="num">{n(total)}</span> unlock{total === 1 ? "" : "s"} on this
            account.
          </p>
        </section>

        <section>
          <h2 className="t-label">Spaces</h2>
          {joined.length === 0 ? (
            <p className="t-sec">You haven&apos;t joined any yet.</p>
          ) : (
            <ul className="setspaces">
              {joined.map((s) => (
                <li key={s.id}>
                  <a href={`/s/${s.slug}`}>{s.name}</a>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="t-label">About</h2>
          <p className="t-sec">
            MaxPoll is 18+. Votes are public. There are no passwords — you sign in with
            Google, so <b>account recovery means recovering your Google account</b>. If
            you lose access to it, this account can&apos;t be reached.
          </p>
        </section>

        <form action={signOut}>
          <button type="submit" className="btn sec fullw">
            Sign out
          </button>
        </form>

        <DeleteAccount handle={profile.handle} />
      </div>
    </AppShell>
  );
}
