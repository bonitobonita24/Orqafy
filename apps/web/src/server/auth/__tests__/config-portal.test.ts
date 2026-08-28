// config-portal.test.ts — the customer-portal Credentials provider + the
// jwt/session callback branching added on top of the existing staff auth
// flow (T1.2/T1.3). Every staff-path assertion here is a REGRESSION GUARD:
// it proves the pre-existing behavior is byte-identical after the portal
// branch was added.
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/env", () => ({
  env: { AUTH_SECRET: "x".repeat(48) },
}));

vi.mock("@/server/lib/rate-limit", () => ({
  rateLimiters: {
    auth: { check: vi.fn() },
    api: { check: vi.fn() },
    upload: { check: vi.fn() },
    public: { check: vi.fn() },
  },
}));

const { mockVerifyCredentials, mockVerifyPortalCredentials, mockUserFindUnique, mockCustomerFindUnique } =
  vi.hoisted(() => ({
    mockVerifyCredentials: vi.fn(),
    mockVerifyPortalCredentials: vi.fn(),
    mockUserFindUnique: vi.fn(),
    mockCustomerFindUnique: vi.fn(),
  }));

vi.mock("@/server/auth/verify-credentials", () => ({
  verifyCredentials: mockVerifyCredentials,
}));
vi.mock("@/server/auth/verify-portal-credentials", () => ({
  verifyPortalCredentials: mockVerifyPortalCredentials,
}));
vi.mock("@orqafy/db", () => ({
  prisma: {
    user: { findUnique: mockUserFindUnique },
    customer: { findUnique: mockCustomerFindUnique },
  },
}));

import { authConfig } from "../config";

function fakeRequest(): any {
  return { headers: { get: (): string | null => null } };
}

// Credentials() (@auth/core) wraps the real options under `.options` — the
// hard-coded `.authorize: () => null` on the returned object is never the
// one Auth.js actually invokes at runtime (Auth.js's init step reads
// `.options`). Testing through `.options` exercises the exact function this
// file wrote in config.ts.
const [staffProviderRaw, portalProviderRaw] = authConfig.providers as any[];
const staffProvider = staffProviderRaw.options;
const portalProvider = portalProviderRaw.options;

const jwtCallback = (authConfig.callbacks as any).jwt as (args: any) => any;
const sessionCallback = (authConfig.callbacks as any).session as (args: any) => any;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("provider wiring", () => {
  it("staff provider keeps id 'credentials' (matches existing signIn('credentials', ...) call sites)", () => {
    expect(staffProvider.id).toBe("credentials");
  });

  it("portal provider has id 'portal'", () => {
    expect(portalProvider.id).toBe("portal");
  });
});

describe("portal provider authorize()", () => {
  it("rejects malformed credentials without calling verifyPortalCredentials", async () => {
    const result = await portalProvider.authorize({ email: "not-an-email" }, fakeRequest());
    expect(result).toBeNull();
    expect(mockVerifyPortalCredentials).not.toHaveBeenCalled();
  });

  it("returns null when verifyPortalCredentials fails", async () => {
    mockVerifyPortalCredentials.mockResolvedValueOnce(null);
    const result = await portalProvider.authorize(
      { email: "jane@customer.com", password: "pw", tenantSlug: "acme" },
      fakeRequest(),
    );
    expect(result).toBeNull();
  });

  it("returns a customer-shaped user on success — no roleId/roles, id carries a 'customer:' marker", async () => {
    mockVerifyPortalCredentials.mockResolvedValueOnce({
      customerId: "customer-1",
      tenantId: "tenant-1",
      tenantSlug: "acme",
      customerSecurityVersion: 1,
      email: "jane@customer.com",
    });

    const result = await portalProvider.authorize(
      { email: "jane@customer.com", password: "pw", tenantSlug: "acme" },
      fakeRequest(),
    );

    expect(result).toEqual({
      id: "customer:customer-1",
      principalType: "customer",
      customerId: "customer-1",
      tenantId: "tenant-1",
      tenantSlug: "acme",
      customerSecurityVersion: 1,
      email: "jane@customer.com",
    });
    expect(result.roleId).toBeUndefined();
    expect(result.roles).toBeUndefined();
  });
});

describe("staff provider authorize() — REGRESSION GUARD (unchanged behavior)", () => {
  it("still delegates to verifyCredentials on valid input", async () => {
    mockVerifyCredentials.mockResolvedValueOnce({
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

    const result = await staffProvider.authorize(
      { email: "jane@acme.com", password: "pw", tenantSlug: "acme" },
      fakeRequest(),
    );

    expect(mockVerifyCredentials).toHaveBeenCalledWith({
      email: "jane@acme.com",
      password: "pw",
      tenantSlug: "acme",
    });
    expect(result).toMatchObject({ id: "user-1", roleId: "role-1" });
  });
});

describe("jwt callback", () => {
  it("staff sign-in — REGRESSION GUARD: copies the same fields as before, defaults principalType to 'staff'", async () => {
    const token = await jwtCallback({
      token: {},
      user: {
        id: "user-1",
        roles: ["admin"],
        roleId: "role-1",
        tenantSlug: "acme",
        tenantId: "tenant-1",
        securityVersion: 2,
        isDemoTenant: false,
      },
    });
    expect(token).toMatchObject({
      principalType: "staff",
      userId: "user-1",
      roles: ["admin"],
      roleId: "role-1",
      tenantSlug: "acme",
      tenantId: "tenant-1",
      securityVersion: 2,
      isDemoTenant: false,
    });
    expect(token.customerId).toBeUndefined();
  });

  it("customer sign-in — copies principalType + customer fields, no roleId/roles/userId set", async () => {
    const token = await jwtCallback({
      token: {},
      user: {
        id: "customer:customer-1",
        principalType: "customer",
        customerId: "customer-1",
        tenantId: "tenant-1",
        tenantSlug: "acme",
        customerSecurityVersion: 1,
      },
    });
    expect(token).toMatchObject({
      principalType: "customer",
      customerId: "customer-1",
      tenantId: "tenant-1",
      tenantSlug: "acme",
      customerSecurityVersion: 1,
    });
    expect(token.userId).toBeUndefined();
    expect(token.roleId).toBeUndefined();
    expect(token.roles).toBeUndefined();
  });

  it("staff subsequent call (no `user`) — REGRESSION GUARD: no DB call, token passed through unchanged", async () => {
    const existingToken = {
      principalType: "staff",
      userId: "user-1",
      roles: ["admin"],
      roleId: "role-1",
      tenantSlug: "acme",
      tenantId: "tenant-1",
      securityVersion: 2,
      isDemoTenant: false,
    };
    const token = await jwtCallback({ token: existingToken, user: undefined });
    expect(token).toBe(existingToken);
    expect(mockCustomerFindUnique).not.toHaveBeenCalled();
    expect(mockUserFindUnique).not.toHaveBeenCalled();
  });

  it("customer subsequent call — re-validates against the DB, marks invalidated on securityVersion mismatch", async () => {
    mockCustomerFindUnique.mockResolvedValueOnce({
      isActive: true,
      portalEnabled: true,
      customerSecurityVersion: 99, // bumped since token was minted
    });
    const token = await jwtCallback({
      token: {
        principalType: "customer",
        customerId: "customer-1",
        tenantId: "tenant-1",
        tenantSlug: "acme",
        customerSecurityVersion: 1,
      },
      user: undefined,
    });
    expect(mockCustomerFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "customer-1" } }),
    );
    expect(token.error).toBe("SESSION_INVALIDATED");
  });

  it("customer subsequent call — marks invalidated when portal disabled or customer deactivated", async () => {
    mockCustomerFindUnique.mockResolvedValueOnce({
      isActive: true,
      portalEnabled: false,
      customerSecurityVersion: 1,
    });
    const token = await jwtCallback({
      token: {
        principalType: "customer",
        customerId: "customer-1",
        tenantId: "tenant-1",
        tenantSlug: "acme",
        customerSecurityVersion: 1,
      },
      user: undefined,
    });
    expect(token.error).toBe("SESSION_INVALIDATED");
  });

  it("customer subsequent call — clears a stale error once re-validated OK", async () => {
    mockCustomerFindUnique.mockResolvedValueOnce({
      isActive: true,
      portalEnabled: true,
      customerSecurityVersion: 1,
    });
    const token = await jwtCallback({
      token: {
        principalType: "customer",
        customerId: "customer-1",
        tenantId: "tenant-1",
        tenantSlug: "acme",
        customerSecurityVersion: 1,
        error: "SESSION_INVALIDATED",
      },
      user: undefined,
    });
    expect(token.error).toBeUndefined();
  });
});

describe("session callback", () => {
  it("staff session — REGRESSION GUARD: re-validates via db.user.findUnique, same shape as before", async () => {
    mockUserFindUnique.mockResolvedValueOnce({ securityVersion: 2, isActive: true });
    const session = await sessionCallback({
      session: { user: {} },
      token: {
        principalType: "staff",
        userId: "user-1",
        roles: ["admin"],
        roleId: "role-1",
        tenantSlug: "acme",
        tenantId: "tenant-1",
        securityVersion: 2,
        isDemoTenant: false,
      },
    });
    expect(mockUserFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "user-1" } }),
    );
    expect(session.principalType).toBe("staff");
    expect(session.user).toMatchObject({
      id: "user-1",
      roles: ["admin"],
      roleId: "role-1",
      tenantSlug: "acme",
      tenantId: "tenant-1",
      securityVersion: 2,
      isDemoTenant: false,
    });
  });

  it("staff session — REGRESSION GUARD: securityVersion mismatch invalidates exactly as before", async () => {
    mockUserFindUnique.mockResolvedValueOnce({ securityVersion: 99, isActive: true });
    const session = await sessionCallback({
      session: { user: {} },
      token: { principalType: "staff", userId: "user-1", securityVersion: 2 },
    });
    expect(session.error).toBe("SESSION_INVALIDATED");
  });

  it("staff session — REGRESSION GUARD: deactivated user invalidates exactly as before", async () => {
    mockUserFindUnique.mockResolvedValueOnce({ securityVersion: 2, isActive: false });
    const session = await sessionCallback({
      session: { user: {} },
      token: { principalType: "staff", userId: "user-1", securityVersion: 2 },
    });
    expect(session.error).toBe("SESSION_INVALIDATED");
  });

  it("customer session — exposes principalType:'customer', customerId, empty roles, no roleId", async () => {
    const session = await sessionCallback({
      session: { user: {} },
      token: {
        principalType: "customer",
        customerId: "customer-1",
        tenantId: "tenant-1",
        tenantSlug: "acme",
        customerSecurityVersion: 1,
      },
    });
    expect(mockUserFindUnique).not.toHaveBeenCalled();
    expect(session.principalType).toBe("customer");
    expect(session.customerId).toBe("customer-1");
    expect(session.user.roles).toEqual([]);
    expect(session.user.roleId).toBe("");
    expect(session.user.id).toBe("");
  });

  it("customer session — propagates SESSION_INVALIDATED set by the jwt callback", async () => {
    const session = await sessionCallback({
      session: { user: {} },
      token: {
        principalType: "customer",
        customerId: "customer-1",
        error: "SESSION_INVALIDATED",
      },
    });
    expect(session.error).toBe("SESSION_INVALIDATED");
  });
});
