/**
 * ORQ-37: the middleware matcher must exclude whole path segments only.
 *
 * The old matcher `/((?!api|_next/static|_next/image|images|fonts|icons).*)`
 * used an unanchored negative lookahead, so any path whose first segment merely
 * STARTED with an excluded word (/apiary/dashboard, /iconsult/...) skipped
 * middleware entirely, and with it the session + tenant checks.
 *
 * Next.js only honours a matcher written as a literal in middleware.ts
 * (it is statically analysed at build time), so this test reads the literal
 * from the source file and compiles it with Next's own build-time compiler
 * (getMiddlewareMatchers), the same code that produces the runtime regexp.
 * Importing middleware.ts directly would pull next-auth into vitest.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

type Matcher = { regexp: string };
type GetMiddlewareMatchers = (
  matchers: string[],
  nextConfig: Record<string, unknown>,
) => Matcher[];

const require = createRequire(import.meta.url);
const { getMiddlewareMatchers } = require(
  "next/dist/build/analysis/get-page-static-info.js",
) as { getMiddlewareMatchers: GetMiddlewareMatchers };

const src = readFileSync(fileURLToPath(new URL("../../middleware.ts", import.meta.url)), "utf8");
const matcherBlock = (/matcher:\s*\[([\s\S]*?)\]\s*,?\s*\}/.exec(src)?.[1] ?? "")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");
const matcherSources = [...matcherBlock.matchAll(/"([^"]+)"/g)].map((m) => m[1] as string);

const regexps = getMiddlewareMatchers(matcherSources, {}).map((m) => new RegExp(m.regexp));
const runsMiddleware = (pathname: string): boolean => regexps.some((re) => re.test(pathname));

describe("middleware config.matcher (ORQ-37)", () => {
  it("has exactly one static matcher literal", () => {
    expect(matcherSources).toHaveLength(1);
  });

  it.each([
    "/api",
    "/api/health",
    "/api/trpc/user.me",
    "/api/auth/session",
    "/_next/static/chunks/main.js",
    "/_next/image",
    "/images/a.png",
    "/fonts/x.woff2",
    "/icons/x.svg",
  ])("skips middleware for excluded path %s", (p) => {
    expect(runsMiddleware(p)).toBe(false);
  });

  it.each([
    "/",
    "/login",
    "/demo/dashboard",
    "/acme/expenses",
    // Tenant slugs that merely START with an excluded word must still be guarded.
    "/apiary/dashboard",
    "/api-co/payroll",
    "/imagesco/x",
    "/fontsmith/dashboard",
    "/iconsult/dashboard",
    "/_nextgen/dashboard",
    // Metadata/static files stay under middleware; isPublic() lets them through.
    "/favicon.ico",
    "/icon.svg",
    "/robots.txt",
    "/sitemap.xml",
    "/brand/powerbyte/logo.svg",
  ])("runs middleware for %s", (p) => {
    expect(runsMiddleware(p)).toBe(true);
  });
});
