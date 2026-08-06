import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

/**
 * 01-product names search discovery as a core differentiator over a WhatsApp
 * poll, and there was no robots.txt at all — so every crawler was guessing,
 * including about the routes below.
 *
 * The disallows are not about secrecy (RLS and `requireAdmin()` handle that).
 * They stop a crawler burning the free tier on pages that are per-user by
 * definition and can never rank: a signed-out crawler gets a redirect from most
 * of them and a 404 from `/admin`, and every one of those is a function
 * invocation.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/settings", "/activity", "/profile", "/pay/", "/auth/", "/api/"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  };
}
