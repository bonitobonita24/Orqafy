import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";

const { mockTenantFindUnique, mockUserFindFirst, mockUserFindUnique } = vi.hoisted(() => ({
  mockTenantFindUnique: vi.fn(),
  mockUserFindFirst: vi.fn(),
  mockUserFindUnique: vi.fn(),
}));

vi.mock("@orqafy/db", () => ({
  prisma: {
    tenant: { findUnique: mockTenantFindUnique },
    user: { findFirst: mockUserFindFirst, findUnique: mockUserFindUnique },
  },
}));

import { verifyCredentials, verifyCredentialsByEmail } from "../verify-credentials";

const PASSWORD = "correct-horse-battery-staple";
let HASH: string;

const TENANT = { id: "tenant-1", isActive: true, slug: "acme" };
const USER_ROW = {
  id: "user-1",
  email: "jane@acme.com",
  firstName: "Jane",
  lastName: "Doe",
  displayName: null,
  passwordHash: "",
  securityVersion: 2,
  roleId: "role-1",
  role: { name: "admin" },
};

beforeEach(async () => {
  vi.clearAllMocks();
  HASH = await bcrypt.hash(PASSWORD, 10);
});

describe("verifyCredentials (tenant-scoped — web login shape)", () => {
  it("returns null when the tenant does not exist or is inactive", async () => {
    mockTenantFindUnique.mockResolvedValueOnce(null);
    const result = await verifyCredentials({
      email: "jane@acme.com",
      password: PASSWORD,
      tenantSlug: "nope",
    });
    expect(result).toBeNull();
    expect(mockUserFindFirst).not.toHaveBeenCalled();
  });

  it("returns null when no matching active user exists in the tenant", async () => {
    mockTenantFindUnique.mockResolvedValueOnce(TENANT);
    mockUserFindFirst.mockResolvedValueOnce(null);
    const result = await verifyCredentials({
      email: "jane@acme.com",
      password: PASSWORD,
      tenantSlug: "acme",
    });
    expect(result).toBeNull();
  });

  it("returns null when the password is wrong (never leaks which check failed)", async () => {
    mockTenantFindUnique.mockResolvedValueOnce(TENANT);
    mockUserFindFirst.mockResolvedValueOnce({ ...USER_ROW, passwordHash: HASH });
    const result = await verifyCredentials({
      email: "jane@acme.com",
      password: "wrong-password",
      tenantSlug: "acme",
    });
    expect(result).toBeNull();
  });

  it("returns the verified user shape on success, scoping the lookup to the tenant", async () => {
    mockTenantFindUnique.mockResolvedValueOnce(TENANT);
    mockUserFindFirst.mockResolvedValueOnce({ ...USER_ROW, passwordHash: HASH });

    const result = await verifyCredentials({
      email: "jane@acme.com",
      password: PASSWORD,
      tenantSlug: "acme",
    });

    expect(mockUserFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: "jane@acme.com", tenantId: "tenant-1", isActive: true },
      }),
    );
    expect(result).toEqual({
      id: "user-1",
      email: "jane@acme.com",
      name: "Jane Doe",
      roles: ["admin"],
      roleId: "role-1",
      tenantSlug: "acme",
      tenantId: "tenant-1",
      securityVersion: 2,
      isDemoTenant: false,
    });
  });

  it("flags isDemoTenant when tenantSlug is 'demo'", async () => {
    mockTenantFindUnique.mockResolvedValueOnce({ ...TENANT, slug: "demo" });
    mockUserFindFirst.mockResolvedValueOnce({ ...USER_ROW, passwordHash: HASH });
    const result = await verifyCredentials({
      email: "jane@acme.com",
      password: PASSWORD,
      tenantSlug: "demo",
    });
    expect(result?.isDemoTenant).toBe(true);
  });
});

describe("verifyCredentialsByEmail (global-email — mobile login shape)", () => {
  const USER_WITH_TENANT = {
    ...USER_ROW,
    passwordHash: "",
    isActive: true,
    tenant: { id: "tenant-1", slug: "acme", isActive: true },
  };

  it("returns null when no user has that email", async () => {
    mockUserFindUnique.mockResolvedValueOnce(null);
    const result = await verifyCredentialsByEmail({ email: "nobody@x.com", password: PASSWORD });
    expect(result).toBeNull();
  });

  it("returns null when the user is deactivated", async () => {
    mockUserFindUnique.mockResolvedValueOnce({ ...USER_WITH_TENANT, isActive: false, passwordHash: HASH });
    const result = await verifyCredentialsByEmail({ email: "jane@acme.com", password: PASSWORD });
    expect(result).toBeNull();
  });

  it("returns null when the user's tenant is deactivated", async () => {
    mockUserFindUnique.mockResolvedValueOnce({
      ...USER_WITH_TENANT,
      passwordHash: HASH,
      tenant: { id: "tenant-1", slug: "acme", isActive: false },
    });
    const result = await verifyCredentialsByEmail({ email: "jane@acme.com", password: PASSWORD });
    expect(result).toBeNull();
  });

  it("returns null on wrong password", async () => {
    mockUserFindUnique.mockResolvedValueOnce({ ...USER_WITH_TENANT, passwordHash: HASH });
    const result = await verifyCredentialsByEmail({ email: "jane@acme.com", password: "nope" });
    expect(result).toBeNull();
  });

  it("resolves the tenant FROM the user row and returns the verified shape on success", async () => {
    mockUserFindUnique.mockResolvedValueOnce({ ...USER_WITH_TENANT, passwordHash: HASH });

    const result = await verifyCredentialsByEmail({ email: "jane@acme.com", password: PASSWORD });

    expect(mockUserFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: "jane@acme.com" } }),
    );
    expect(result).toEqual({
      id: "user-1",
      email: "jane@acme.com",
      name: "Jane Doe",
      roles: ["admin"],
      roleId: "role-1",
      tenantSlug: "acme",
      tenantId: "tenant-1",
      securityVersion: 2,
      isDemoTenant: false,
    });
  });
});
