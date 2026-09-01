import type { MetadataRoute } from "next";

import { prisma as db } from "@orqafy/db";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// Flagship/demo tenant whose storefront is enumerated into the sitemap.
// D-SEO 2026-09-01: index the demo/flagship store ONLY — NOT every tenant's
// catalogue (that outward-facing decision was deliberately not taken; other
// tenant stores stay individually crawlable via index:true links but are not
// enumerated here). Override the slug without a code change via env.
const STORE_TENANT_SLUG = process.env.SITEMAP_STORE_TENANT_SLUG ?? "demo";

// Cap well under Google's 50,000-URL / 50 MB single-sitemap limit.
const MAX_STORE_PRODUCTS = 5000;

// Regenerate hourly rather than baking the storefront into the build — keeps
// the product list current without a per-request DB hit, and (with the
// try/catch below) means a DB outage at build time never fails the build.
export const revalidate = 3600;

const STATIC_ROUTES: MetadataRoute.Sitemap = [
  { url: `${BASE}/`, lastModified: new Date(), priority: 1 },
  { url: `${BASE}/register`, lastModified: new Date(), priority: 0.8 },
  { url: `${BASE}/privacy`, lastModified: new Date(), priority: 0.5 },
];

// Enumerate the flagship tenant's public storefront: the store landing, the
// product list, and every publicly-visible product. Mirrors the public
// storefront filter (isActive + ecommerceVisible) and URL shape
// (ecommerceSlug ?? id) from storefront.browsePublicProducts / product-card.
async function storeRoutes(): Promise<MetadataRoute.Sitemap> {
  const tenant = await db.tenant.findUnique({
    where: { slug: STORE_TENANT_SLUG },
    select: { id: true, isActive: true },
  });
  if (tenant === null || tenant.isActive === false) {
    return [];
  }

  const products = await db.product.findMany({
    where: {
      tenantId: tenant.id,
      isActive: true,
      ecommerceVisible: true,
    },
    select: { id: true, ecommerceSlug: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
    take: MAX_STORE_PRODUCTS,
  });

  const storeBase = `${BASE}/${STORE_TENANT_SLUG}/store`;
  return [
    { url: storeBase, lastModified: new Date(), priority: 0.7 },
    { url: `${storeBase}/products`, lastModified: new Date(), priority: 0.7 },
    ...products.map((p) => ({
      url: `${storeBase}/products/${p.ecommerceSlug ?? p.id}`,
      lastModified: p.updatedAt,
      priority: 0.6,
    })),
  ];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    return [...STATIC_ROUTES, ...(await storeRoutes())];
  } catch {
    // Fail open: a DB error must never break the sitemap (or the build).
    // Marketing routes are always served; the storefront simply drops off
    // until the DB is reachable again.
    return STATIC_ROUTES;
  }
}
