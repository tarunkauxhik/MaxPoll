# Learnings

Things that cost time, in the order they bit us. Add to this rather than
rediscovering them.

---

## Phase 1

### `create-next-app` rejects capitalised directory names
The repo lives at `…\projects\MaxPoll`, and create-next-app derives the package
name from the directory:

```
Could not create a project called "MaxPoll" because of npm naming restrictions:
  * name can no longer contain capital letters
```

Scaffolded into a temp dir as `maxpoll` and copied the output in. No behavioural
difference. Next's demo assets (`public/*.svg`, `page.module.css`, `README.md`)
were deliberately not carried over.

### pnpm 11 blocks postinstall scripts and aborts the install
`sharp` and `unrs-resolver` need build scripts; pnpm 11 refuses to run them by
default and then **aborts the whole install** rather than warning. The switch
now lives in `pnpm-workspace.yaml`, not `package.json`:

```yaml
allowBuilds:
  sharp: true
  unrs-resolver: true
```

### `create-next-app` shipped 16.2.12, not latest
Even with `@latest` the template pinned an older Next. Explicitly bumped:
`pnpm update next@16.3.0 eslint-config-next@16.3.0`. Worth checking the
resolved version after any scaffold.

### Turbopack no longer needs a flag
In Next 16 it's the default bundler, so `package.json` scripts are plain
`next dev` / `next build` — the `--turbopack` flag from older guides is gone.

---

## Verified platform facts (checked 2026-08-04, re-check before launch)

These are the numbers the architecture actually depends on. Providers move them.

**Vercel Hobby**
- Functions run in a **single region**; default `iad1`. Mumbai is `bom1`
- Active CPU **4 CPU-hrs/mo** · Invocations **1M** · Fast Data Transfer **100GB**
- **Fast Origin Transfer only ~10GB/mo** — tighter than bandwidth, and the one
  that cache misses actually consume
- Cron: **once per day maximum** (sub-daily fails at deploy time), **10s
  timeout**, UTC only, fires anywhere within the scheduled hour
- CDN will **not** cache a response with `Set-Cookie`, or a request with
  `Authorization`
- CDN cache is **segmented per region**
- `Cache-Control` without `CDN-Cache-Control`: Vercel strips `s-maxage` and
  `stale-while-revalidate` before the response reaches the browser
- `stale-if-error` and `proxy-revalidate` are **not** supported
- Max cacheable response: 10MB (20MB streaming)
- Non-commercial use only; cannot connect to org-owned Git repos

**Supabase Free**
- 500MB DB · 5GB egress · 50k MAU · 1GB storage · 2 active projects
- **Pauses after 7 days with no API requests.** Hence the daily ping cron
- No backups

**Next.js** — 16.3.0 current as of 2026-08-03.

---

## Spec conflicts worth remembering

The RefDocs are drafts and several claims didn't survive checking. All of them
are written up in [01-DECISIONS.md](01-DECISIONS.md) §A. The one most likely to
be quietly re-broken later:

> **A2** — putting the board route behind the Supabase auth middleware silently
> disables edge caching, because the middleware sets a cookie. There is no error
> and nothing looks wrong. The only symptom is the Vercel usage graph climbing
> with viewer count instead of staying flat. Check `x-vercel-cache: HIT`.
