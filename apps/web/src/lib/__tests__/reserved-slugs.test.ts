/**
 * ORQ-35 — reserved tenant slugs.
 *
 * Tenant pages under app/(tenant)/[slug] rely on middleware for auth. A slug that
 * equals a PUBLIC_PATHS top segment is treated as public by isPublic(); a slug that
 * equals a matcher-excluded first segment never reaches middleware. The guard tests
 * below make that collision impossible to reintroduce silently. (ORQ-37 anchored
 * the matcher exclusions to whole segments, so prefixes like "apiary" are allowed.)
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { isReservedSlug, RESERVED_TENANT_SLUGS } from "../reserved-slugs";
import { PUBLIC_PATHS, isPublic } from "../public-paths";

describe("isReservedSlug", () => {
  it("rejects Rule 41 slugs", () => {
    for (const s of ["tm", "demo", "platform", "admin", "login", "api"]) {
      expect(isReservedSlug(s)).toBe(true);
    }
  });

  it("rejects the slugs from both former inline lists", () => {
    for (const s of ["www", "mail", "static", "assets", "app", "auth", "register", "signup", "dashboard", "billing", "support"]) {
      expect(isReservedSlug(s)).toBe(true);
    }
  });

  it("rejects public-path collisions (brand, invoice, privacy, demo-login)", () => {
    for (const s of ["brand", "invoice", "privacy", "demo-login", "store", "portal", "powerbyte-admin"]) {
      expect(isReservedSlug(s)).toBe(true);
    }
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(isReservedSlug("  Invoice ")).toBe(true);
    expect(isReservedSlug("BRAND")).toBe(true);
  });

  it("rejects matcher-excluded first segments exactly", () => {
    for (const s of ["api", "_next", "images", "fonts", "icons"]) {
      expect(isReservedSlug(s)).toBe(true);
    }
  });

  it("allows slugs that merely start with a matcher-excluded word (ORQ-37)", () => {
    for (const s of ["apiary", "api-co", "images-co", "fontsmith", "iconsult"]) {
      expect(isReservedSlug(s)).toBe(false);
    }
  });

  it("allows ordinary slugs", () => {
    for (const s of ["acme", "acme-corp", "brandon", "invoices-r-us", "privacy-first", "tmart", "demos"]) {
      expect(isReservedSlug(s)).toBe(false);
    }
    expect(isReservedSlug("")).toBe(false);
  });
});

describe("guard: every public path top segment is reserved", () => {
  const segments = PUBLIC_PATHS.map((p) => p.split("/").filter(Boolean)[0]).filter(
    (s): s is string => s !== undefined,
  );

  it("has segments to check", () => {
    expect(segments.length).toBeGreaterThan(5);
  });

  it.each(segments)("public top segment %s is reserved", (seg) => {
    expect(isReservedSlug(seg)).toBe(true);
  });

  it("documents the exploit: a colliding slug's authed pages are public", () => {
    expect(isPublic("/acme/expenses")).toBe(false);
    expect(isPublic("/invoice/expenses")).toBe(true);
    expect(isPublic("/privacy/employees")).toBe(true);
    expect(isPublic("/demo-login/payroll")).toBe(true);
    expect(RESERVED_TENANT_SLUGS.has("invoice")).toBe(true);
  });
});

describe("guard: every static top-level app route is reserved", () => {
  const appDir = fileURLToPath(new URL("../../app", import.meta.url));
  const staticRoutes = readdirSync(appDir).filter((name) => {
    if (!statSync(join(appDir, name)).isDirectory()) return false;
    return !name.startsWith("(") && !name.startsWith("[") && !name.startsWith("_");
  });
  // Route-group children, e.g. app/(auth)/login.
  const groupRoutes = readdirSync(appDir)
    .filter((name) => name.startsWith("(") && statSync(join(appDir, name)).isDirectory())
    .flatMap((group) =>
      readdirSync(join(appDir, group)).filter(
        (name) =>
          statSync(join(appDir, group, name)).isDirectory() &&
          !name.startsWith("[") &&
          !name.startsWith("("),
      ),
    );

  it("found the known routes", () => {
    expect(staticRoutes).toEqual(expect.arrayContaining(["register", "invoice", "privacy"]));
    expect(groupRoutes).toContain("login");
  });

  it.each([...staticRoutes, ...groupRoutes])("app route %s is reserved", (seg) => {
    expect(isReservedSlug(seg)).toBe(true);
  });
});

describe("guard: middleware matcher exclusions are whole-segment and reserved", () => {
  const src = readFileSync(fileURLToPath(new URL("../../middleware.ts", import.meta.url)), "utf8");
  // Anchored form (ORQ-37): "/((?!(?:a|b/c|...)(?:/|$)).*)". If the anchor is ever
  // dropped this stops matching and the test fails: an unanchored exclusion would
  // need the prefix rule back in reserved-slugs.ts.
  const alternation = /"\/\(\(\?!\(\?:([^)]*)\)\(\?:\/\|\$\)\)\.\*\)"/.exec(src)?.[1];

  it("found the segment-anchored matcher negative lookahead", () => {
    expect(alternation).toBeDefined();
  });

  const segments = (alternation ?? "")
    .split("|")
    .map((alt) => alt.split("/")[0] ?? "")
    .filter(Boolean);

  it("has segments to check", () => {
    expect(segments).toEqual(expect.arrayContaining(["api", "_next", "images", "fonts", "icons"]));
  });

  it.each(segments)("excluded first segment %s is reserved", (seg) => {
    expect(isReservedSlug(seg)).toBe(true);
  });
});
