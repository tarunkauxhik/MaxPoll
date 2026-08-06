import type { MetadataRoute } from "next";
import { createAnonClient } from "@/lib/supabase/anon";
import { siteUrl } from "@/lib/site";

/**
 * There was no sitemap, on a product whose own strategy doc names search
 * discovery as a core differentiator over sending a poll in a WhatsApp group.
 *
 * Live public polls and Spaces, by **readable slug** — never the short code,
 * which is for pasting, and which `alternates.canonical` already points away
 * from. Submitting both would be asking Google to index the same page twice.
 *
 * Anonymous client, so this sees exactly what a crawler can: RLS decides what a
 * signed-out reader may read, and the sitemap cannot list anything past it.
 *
 * `revalidate` caps it at hourly. It runs one query, but a sitemap fetched on
 * every crawler hit is a free-tier leak with no upside — nothing here changes
 * faster than an hour in a way a search engine cares about.
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const supabase = createAnonClient();

  const now = new Date().toISOString();

  const [{ data: polls }, { data: spaces }] = await Promise.all([
    supabase
      .from("polls")
      .select("slug, created_at, vote_count")
      .eq("status", "live")
      .eq("is_private", false)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order("vote_count", { ascending: false })
      // Well inside Google's 50,000-URL limit, and far past anything this
      // product will have before the limit is worth thinking about.
      .limit(2000),
    supabase.from("spaces").select("slug, created_at").limit(500),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "hourly", priority: 1 },
    { url: `${base}/spaces`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.3 },
  ];

  return [
    ...staticPages,
    ...(polls ?? []).map((p: { slug: string; created_at: string }) => ({
      url: `${base}/p/${p.slug}`,
      lastModified: p.created_at,
      // A live poll's board changes by the minute; that is the whole product.
      changeFrequency: "hourly" as const,
      priority: 0.9,
    })),
    ...(spaces ?? []).map((s: { slug: string; created_at: string }) => ({
      url: `${base}/s/${s.slug}`,
      lastModified: s.created_at,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
  ];
}
