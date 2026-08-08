import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// Only tenant-agnostic public marketing routes are listed here.
// TODO(seo): dynamic per-tenant storefront product sitemap requires DB
// enumeration + a product decision on indexing every tenant store —
// deferred (see PENDING_DECISIONS D-SEO).
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    { url: `${BASE}/`, lastModified, priority: 1 },
    { url: `${BASE}/register`, lastModified, priority: 0.8 },
    { url: `${BASE}/privacy`, lastModified, priority: 0.5 },
  ];
}
