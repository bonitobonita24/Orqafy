/**
 * ORQ-35 — READ-ONLY audit: list existing tenants whose slug collides with the
 * reserved tenant-slug set (public-path prefixes, static app routes, Rule 41 names,
 * matcher-excluded prefixes). A colliding tenant's authed pages may be reachable
 * without login. This script only SELECTs; it never modifies data.
 *
 * Run per environment (owner-run; needs DATABASE_URL for that env):
 *   cd apps/web && ../../packages/db/node_modules/.bin/tsx scripts/check-reserved-tenant-slugs.ts
 *   (tsx is a devDependency of @orqafy/db, not of web)
 *
 * Exit code: 0 = no unexpected collisions, 1 = collisions found, 2 = error.
 * The seeded "demo" tenant is expected (Rule 41 demo tenant) and reported as such.
 *
 * Equivalent SQL (exact matches only; prefix rule = api|_next|images|fonts|icons):
 *   SELECT id, slug, status FROM tenants
 *   WHERE lower(slug) IN (<RESERVED_TENANT_SLUGS>)
 *      OR lower(slug) ~ '^(api|_next|images|fonts|icons)';
 */
import { prisma } from "@orqafy/db";
import { isReservedSlug } from "../src/lib/reserved-slugs";

const EXPECTED_SYSTEM_TENANTS = new Set(["demo"]);

async function main(): Promise<number> {
  const tenants = await prisma.tenant.findMany({
    select: { id: true, slug: true, status: true },
    orderBy: { slug: "asc" },
  });
  const hits = tenants.filter((t) => isReservedSlug(t.slug));
  const unexpected = hits.filter((t) => !EXPECTED_SYSTEM_TENANTS.has(t.slug));

  console.log(`Scanned ${tenants.length} tenant(s).`);
  for (const t of hits) {
    const tag = EXPECTED_SYSTEM_TENANTS.has(t.slug) ? "expected system tenant" : "COLLISION";
    console.log(`  [${tag}] slug=${t.slug} id=${t.id} status=${t.status}`);
  }
  if (unexpected.length === 0) {
    console.log("OK: no unexpected reserved-slug collisions.");
    return 0;
  }
  console.log(`FOUND ${unexpected.length} colliding tenant(s) — rename or suspend before relying on the fix.`);
  return 1;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err: unknown) => {
    console.error("check-reserved-tenant-slugs failed:", err);
    process.exitCode = 2;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
