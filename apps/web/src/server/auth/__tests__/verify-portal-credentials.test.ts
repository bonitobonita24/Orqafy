import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";

const { mockTenantFindUnique, mockCustomerFindFirst } = vi.hoisted(() => ({
  mockTenantFindUnique: vi.fn(),
  mockCustomerFindFirst: vi.fn(),
}));

vi.mock("@orqafy/db", () => ({
  prisma: {
    tenant: { findUnique: mockTenantFindUnique },
    customer: { findFirst: mockCustomerFindFirst },
  },
}));

import { verifyPortalCredentials } from "../verify-portal-credentials";

const PASSWORD = "correct-horse-battery-staple";
let HASH: string;

const TENANT = { id: "tenant-1", isActive: true, slug: "acme" };
const CUSTOMER_ROW = {
  id: "customer-1",
  portalEmail: "jane@customer.com",
  portalPasswordHash: "",
  portalEnabled: true,
  customerSecurityVersion: 1,
};

beforeEach(async () => {
  vi.clearAllMocks();
  HASH = await bcrypt.hash(PASSWORD, 10);
});

describe("verifyPortalCredentials", () => {
  it("returns null when the tenant does not exist or is inactive", async () => {
    mockTenantFindUnique.mockResolvedValueOnce(null);
    const result = await verifyPortalCredentials({
      email: "jane@customer.com",
      password: PASSWORD,
      tenantSlug: "nope",
    });
    expect(result).toBeNull();
    expect(mockCustomerFindFirst).not.toHaveBeenCalled();
  });

  it("returns null when tenant is explicitly inactive", async () => {
    mockTenantFindUnique.mockResolvedValueOnce({ ...TENANT, isActive: false });
    const result = await verifyPortalCredentials({
      email: "jane@customer.com",
      password: PASSWORD,
      tenantSlug: "acme",
    });
    expect(result).toBeNull();
    expect(mockCustomerFindFirst).not.toHaveBeenCalled();
  });

  it("returns null when no active customer with that portalEmail exists in the tenant", async () => {
    mockTenantFindUnique.mockResolvedValueOnce(TENANT);
    mockCustomerFindFirst.mockResolvedValueOnce(null);
    const result = await verifyPortalCredentials({
      email: "unknown@customer.com",
      password: PASSWORD,
      tenantSlug: "acme",
    });
    expect(result).toBeNull();
  });

  it("returns null when the customer row exists but portal is not enabled", async () => {
    mockTenantFindUnique.mockResolvedValueOnce(TENANT);
    mockCustomerFindFirst.mockResolvedValueOnce({
      ...CUSTOMER_ROW,
      portalPasswordHash: HASH,
      portalEnabled: false,
    });
    const result = await verifyPortalCredentials({
      email: "jane@customer.com",
      password: PASSWORD,
      tenantSlug: "acme",
    });
    expect(result).toBeNull();
  });

  it("returns null when portalPasswordHash is missing (never set / invited-not-activated)", async () => {
    mockTenantFindUnique.mockResolvedValueOnce(TENANT);
    mockCustomerFindFirst.mockResolvedValueOnce({ ...CUSTOMER_ROW, portalPasswordHash: null });
    const result = await verifyPortalCredentials({
      email: "jane@customer.com",
      password: PASSWORD,
      tenantSlug: "acme",
    });
    expect(result).toBeNull();
  });

  it("returns null when the customer is inactive (excluded by the isActive:true where clause)", async () => {
    mockTenantFindUnique.mockResolvedValueOnce(TENANT);
    mockCustomerFindFirst.mockResolvedValueOnce(null); // isActive:true filter excludes it at the query level
    const result = await verifyPortalCredentials({
      email: "jane@customer.com",
      password: PASSWORD,
      tenantSlug: "acme",
    });
    expect(mockCustomerFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { portalEmail: "jane@customer.com", tenantId: "tenant-1", isActive: true },
      }),
    );
    expect(result).toBeNull();
  });

  it("returns null when the password is wrong (never leaks which check failed)", async () => {
    mockTenantFindUnique.mockResolvedValueOnce(TENANT);
    mockCustomerFindFirst.mockResolvedValueOnce({ ...CUSTOMER_ROW, portalPasswordHash: HASH });
    const result = await verifyPortalCredentials({
      email: "jane@customer.com",
      password: "wrong-password",
      tenantSlug: "acme",
    });
    expect(result).toBeNull();
  });

  it("returns the verified customer shape on success, scoping the lookup to the tenant", async () => {
    mockTenantFindUnique.mockResolvedValueOnce(TENANT);
    mockCustomerFindFirst.mockResolvedValueOnce({ ...CUSTOMER_ROW, portalPasswordHash: HASH });

    const result = await verifyPortalCredentials({
      email: "jane@customer.com",
      password: PASSWORD,
      tenantSlug: "acme",
    });

    expect(result).toEqual({
      customerId: "customer-1",
      tenantId: "tenant-1",
      tenantSlug: "acme",
      customerSecurityVersion: 1,
      email: "jane@customer.com",
    });
  });
});
