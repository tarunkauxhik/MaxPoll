import AppShell from "@/components/shell/AppShell";
import { DeleteRow } from "../AdminForms";
import { requireAdmin, adminSearch } from "../data";

export const metadata = { title: "Remove · Admin" };
export const dynamic = "force-dynamic";

/**
 * Delete any poll or Space.
 *
 * A search box, not a list. This is the only unbounded delete in the product —
 * it bypasses `delete_poll()` / `delete_space()` and their ownership rules
 * entirely — so you have to name the thing you came to remove rather than scroll
 * to it.
 *
 * The query is a URL param, so a result set is a link somebody can be sent.
 */
export default async function AdminRemovePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const supabase = await requireAdmin();
  const { q = "" } = await searchParams;
  const { polls, spaces } = await adminSearch(supabase, q);
  const searched = q.trim().length >= 2;

  return (
    <AppShell>
      <div className="adminwrap">
        <a className="backlink" href="/admin">
          ← Admin
        </a>
        <h1 className="t-title">Remove</h1>
        <p className="t-sec adminlede">
          Deletes anything, whoever made it. A creator&apos;s own delete refuses a
          Space that holds someone else&apos;s polls; this does not. Deleting a Space
          deletes every poll in it.
        </p>

        <form className="onb" method="get">
          <label className="lbl" htmlFor="q">
            Search polls and Spaces
          </label>
          <input
            id="q"
            name="q"
            className="field"
            defaultValue={q}
            placeholder="Title, name or slug"
            autoComplete="off"
          />
          <button type="submit" className="btn pri">
            Search
          </button>
        </form>

        {searched && (
          <>
            <section>
              <h2 className="t-label">
                Polls {polls.length > 0 && <span className="num">({polls.length})</span>}
              </h2>
              {polls.length === 0 ? (
                <p className="t-sec">No poll matches that.</p>
              ) : (
                <ul className="queue">
                  {polls.map((p) => (
                    <li key={p.id}>
                      <DeleteRow
                        kind="poll"
                        id={p.id}
                        name={p.title}
                        href={`/p/${p.slug}`}
                        meta={`${p.spaceName ? `${p.spaceName} · ` : ""}${p.vote_count} vote${
                          p.vote_count === 1 ? "" : "s"
                        } · ${p.status}`}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="t-label">
                Spaces {spaces.length > 0 && <span className="num">({spaces.length})</span>}
              </h2>
              {spaces.length === 0 ? (
                <p className="t-sec">No Space matches that.</p>
              ) : (
                <ul className="queue">
                  {spaces.map((s) => (
                    <li key={s.id}>
                      <DeleteRow
                        kind="space"
                        id={s.id}
                        name={s.name}
                        href={`/s/${s.slug}`}
                        meta={`${s.member_count} member${
                          s.member_count === 1 ? "" : "s"
                        } · deletes every poll inside`}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
