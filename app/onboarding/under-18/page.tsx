import { signOut } from "@/lib/auth-actions";
import { Emoji } from "@/components/ui/Emoji";

export const metadata = { title: "MaxPoll is 18+" };

/**
 * Hard stop. docs/03-ux-flows.md: "Do not soft-gate this."
 *
 * No profile row was created, so there is nothing to delete — the account simply
 * cannot proceed. Friendly, not punitive: they may genuinely come back.
 */
export default function UnderEighteen() {
  return (
    <main className="shell-col state">
      <div className="ic">
        <Emoji char="🎂" />
      </div>
      <h1 className="t-card">MaxPoll is 18+</h1>
      <p>Come back on your birthday — we&apos;ll be here.</p>
      <form action={signOut}>
        <button type="submit" className="btn sec">
          Sign out
        </button>
      </form>
    </main>
  );
}
