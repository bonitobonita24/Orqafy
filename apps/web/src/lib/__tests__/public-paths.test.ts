/**
 * isPublic() — the middleware allow-list guarding which paths never require
 * auth. Proves the D-4 /invoice/[token] flip: the public invoice view is
 * reachable without a session, while normal tenant-scoped routes stay gated.
 */
import { describe, it, expect } from "vitest";
import { isPublic } from "../public-paths";

describe("isPublic", () => {
  it("/invoice/<token> is public (D-4 share-link)", () => {
    expect(isPublic("/invoice/abc123def")).toBe(true);
  });

  it("bare /invoice (no token) is public via prefix match", () => {
    expect(isPublic("/invoice")).toBe(true);
  });

  it("an authed tenant-scoped invoices path stays private", () => {
    expect(isPublic("/some-slug/invoices/x")).toBe(false);
  });

  it("known always-public paths stay public", () => {
    expect(isPublic("/login")).toBe(true);
    expect(isPublic("/api/health")).toBe(true);
  });

  // ORQ-40 — JSON-LD Organization.logo points here; crawlers must fetch it
  // without a session (middleware runs on it since ORQ-37).
  it("/logo.png is public (JSON-LD Organization logo)", () => {
    expect(isPublic("/logo.png")).toBe(true);
    expect(isPublic("/logo.pngx")).toBe(false);
  });

  it("an unrelated authed path stays private", () => {
    expect(isPublic("/some-slug/dashboard")).toBe(false);
  });

  // W1-T1.4 — customer-portal auth pages (public) vs the rest of /portal (private)
  it("/{slug}/portal/login is public (customer sets password / signs in)", () => {
    expect(isPublic("/acme/portal/login")).toBe(true);
  });

  it("/{slug}/portal/accept is public (customer invite-accept flow)", () => {
    expect(isPublic("/acme/portal/accept")).toBe(true);
  });

  it("bare /{slug}/portal (customer dashboard) stays private", () => {
    expect(isPublic("/acme/portal")).toBe(false);
  });

  it("/{slug}/portal/invoices stays private", () => {
    expect(isPublic("/acme/portal/invoices")).toBe(false);
  });

  // Official Powerbyte logo mark shown on guest surfaces (storefront/portal footer)
  it("/brand/powerbyte/* static brand assets are public", () => {
    expect(isPublic("/brand/powerbyte/logo-only-160.png")).toBe(true);
  });

  it("a tenant slugged 'brand' keeps its app routes private", () => {
    expect(isPublic("/brand/dashboard")).toBe(false);
    expect(isPublic("/brand")).toBe(false);
  });
});
