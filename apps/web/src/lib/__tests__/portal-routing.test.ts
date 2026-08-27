/**
 * Portal route isolation between staff and customer principals (W1-T1.4).
 * Proves the (principal x path) -> redirect matrix middleware.ts relies on.
 */
import { describe, it, expect } from "vitest";
import { isPortalPath, resolvePrincipalIsolationRedirect } from "../portal-routing";

describe("isPortalPath", () => {
  it("matches bare /{slug}/portal", () => {
    expect(isPortalPath("/acme/portal")).toBe(true);
  });

  it("matches nested /{slug}/portal/invoices", () => {
    expect(isPortalPath("/acme/portal/invoices")).toBe(true);
  });

  it("does not match /{slug}/dashboard", () => {
    expect(isPortalPath("/acme/dashboard")).toBe(false);
  });
});

describe("resolvePrincipalIsolationRedirect", () => {
  it("staff requesting a portal path is redirected to their dashboard", () => {
    expect(resolvePrincipalIsolationRedirect("/acme/portal", "acme", "staff")).toBe(
      "/acme/dashboard",
    );
    expect(resolvePrincipalIsolationRedirect("/acme/portal/invoices", "acme", "staff")).toBe(
      "/acme/dashboard",
    );
  });

  it("staff requesting a non-portal path proceeds (null)", () => {
    expect(resolvePrincipalIsolationRedirect("/acme/dashboard", "acme", "staff")).toBeNull();
  });

  it("undefined principalType (legacy staff session) treated as staff", () => {
    expect(resolvePrincipalIsolationRedirect("/acme/portal", "acme", undefined)).toBe(
      "/acme/dashboard",
    );
    expect(resolvePrincipalIsolationRedirect("/acme/dashboard", "acme", undefined)).toBeNull();
  });

  it("customer requesting a non-portal (staff) path is redirected to the portal", () => {
    expect(resolvePrincipalIsolationRedirect("/acme/dashboard", "acme", "customer")).toBe(
      "/acme/portal",
    );
    expect(resolvePrincipalIsolationRedirect("/acme/invoices", "acme", "customer")).toBe(
      "/acme/portal",
    );
  });

  it("customer requesting a portal path proceeds (null)", () => {
    expect(resolvePrincipalIsolationRedirect("/acme/portal", "acme", "customer")).toBeNull();
    expect(resolvePrincipalIsolationRedirect("/acme/portal/invoices", "acme", "customer")).toBeNull();
  });
});
