// Single source of truth for tenant slugs that may never be registered (ORQ-35, Rule 41 F4).
//
// Why this matters: tenant routes live at /{slug}/..., and the page routes under
// app/(tenant)/[slug] rely on middleware for auth (server components query by
// URL slug). If a tenant slug equals the first segment of a PUBLIC_PATHS entry,
// isPublic() lets /{slug}/* through without a session. If a slug starts with a
// prefix the middleware matcher excludes, the middleware never runs at all.
// Either way the tenant's authed pages become reachable without login.
//
// Every tenant-slug creation or rename path must call isReservedSlug() server-side.
// Guard tests in lib/__tests__/reserved-slugs.test.ts fail if a new public path,
// top-level app route or matcher exclusion is added without being reserved here.

import { PUBLIC_PATHS } from "./public-paths";

// Rule 41 F4 (.ai_prompt/rbac.md): platform/system route names.
const RULE_41_SLUGS = ["tm", "demo", "platform", "admin", "login", "api"] as const;

// The lists previously duplicated in register/actions.ts and the registration router.
const LEGACY_SLUGS = [
  "platform", "demo", "admin", "api", "www", "mail", "static", "assets",
  "app", "auth", "login", "register", "signup", "dashboard", "billing", "support",
] as const;

// Static top-level routes under apps/web/src/app (excluding [slug] and route
// groups), plus top-level metadata routes. A tenant with one of these slugs would
// collide with the static route.
const APP_ROUTE_SLUGS = [
  "api", "demo-login", "invoice", "login", "powerbyte-admin", "privacy", "register",
  "robots.txt", "sitemap.xml", "icon.svg", "favicon.ico",
] as const;

// Reserved ahead of routes that exist on other branches or are planned
// (/brand/powerbyte public prefix; storefront/portal segment names; public assets).
const FORWARD_SLUGS = [
  "brand", "store", "portal", "robots", "sitemap", "public", "images", "fonts", "icons",
  "static", "_next",
] as const;

// First path segments the middleware matcher excludes with an UNANCHORED negative
// lookahead (`/((?!api|_next/static|_next/image|images|fonts|icons).*)`), so any
// slug that merely STARTS with one of these skips middleware entirely
// (e.g. "apiary", "images-co"). Reject by prefix.
export const RESERVED_TENANT_SLUG_PREFIXES: readonly string[] = [
  "api", "_next", "images", "fonts", "icons",
];

function topSegment(path: string): string | null {
  const seg = path.split("/").filter((s) => s.length > 0)[0];
  return seg === undefined ? null : seg.toLowerCase();
}

const PUBLIC_PATH_SLUGS = PUBLIC_PATHS.map(topSegment).filter(
  (s): s is string => s !== null,
);

export const RESERVED_TENANT_SLUGS: ReadonlySet<string> = new Set<string>([
  ...RULE_41_SLUGS,
  ...LEGACY_SLUGS,
  ...APP_ROUTE_SLUGS,
  ...FORWARD_SLUGS,
  ...PUBLIC_PATH_SLUGS,
]);

export function isReservedSlug(slug: string): boolean {
  const s = slug.trim().toLowerCase();
  if (s.length === 0) return false;
  if (RESERVED_TENANT_SLUGS.has(s)) return true;
  return RESERVED_TENANT_SLUG_PREFIXES.some((p) => s.startsWith(p));
}
