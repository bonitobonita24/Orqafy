/**
 * getPortalTenantBranding — shared tenant-branding lookup for the
 * customer-portal login/accept/shell pages.
 *
 * Proves:
 *  1. empty slug -> null, no DB hit
 *  2. unknown slug -> null (DB returns null)
 *  3. known slug -> the exact branding-only select shape
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockTenantFindUnique } = vi.hoisted(() => ({
  mockTenantFindUnique: vi.fn(),
}));

vi.mock("@orqafy/db", () => ({
  prisma: {
    tenant: { findUnique: mockTenantFindUnique },
  },
}));

import { getPortalTenantBranding } from "../portal-tenant";

describe("getPortalTenantBranding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("empty slug -> null, no DB hit", async () => {
    const result = await getPortalTenantBranding("");
    expect(result).toBeNull();
    expect(mockTenantFindUnique).not.toHaveBeenCalled();
  });

  it("unknown slug -> null", async () => {
    mockTenantFindUnique.mockResolvedValue(null);
    const result = await getPortalTenantBranding("nope");
    expect(result).toBeNull();
    expect(mockTenantFindUnique).toHaveBeenCalledWith({
      where: { slug: "nope" },
      select: { id: true, name: true, slug: true, logoUrl: true },
    });
  });

  it("known slug -> branding row", async () => {
    mockTenantFindUnique.mockResolvedValue({
      id: "tenant-1",
      name: "Acme Co",
      slug: "acme",
      logoUrl: "https://example.com/logo.png",
    });
    const result = await getPortalTenantBranding("acme");
    expect(result).toEqual({
      id: "tenant-1",
      name: "Acme Co",
      slug: "acme",
      logoUrl: "https://example.com/logo.png",
    });
  });
});
