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

  it("an unrelated authed path stays private", () => {
    expect(isPublic("/some-slug/dashboard")).toBe(false);
  });
});
