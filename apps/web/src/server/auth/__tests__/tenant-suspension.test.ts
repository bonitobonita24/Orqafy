// tenant-suspension.test.ts — ORQ-38. A platform-admin suspend
// (platform.suspendTenant → tenant.status = "suspended") must end LIVE
// sessions of that tenant on the next request, not only block new logins.
// Enforcement lives in the Auth.js callbacks (run on every auth() call —
// middleware (Node runtime), server pages, tRPC context), so every consumer
// that already honours SESSION_INVALIDATED is covered.
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

const { mockUserFindUnique, mockCustomerFindUnique } = vi.hoisted(() => ({
  mockUserFindUnique: vi.fn(),
  mockCustomerFindUnique: vi.fn(),
}));

vi.mock("@/server/auth/verify-credentials", () => ({ verifyCredentials: vi.fn() }));
vi.mock("@/server/auth/verify-portal-credentials", () => ({ verifyPortalCredentials: vi.fn() }));
vi.mock("@orqafy/db", () => ({
  prisma: {
    user: { findUnique: mockUserFindUnique },
    customer: { findUnique: mockCustomerFindUnique },
  },
}));

import { authConfig } from "../config";
import { isTenantSuspended } from "../tenant-status";

const jwtCallback = (authConfig.callbacks as any).jwt as (args: any) => any;
const sessionCallback = (authConfig.callbacks as any).session as (args: any) => any;

const STAFF_TOKEN = {
  principalType: "staff",
  userId: "user-1",
  roles: ["admin"],
  roleId: "role-1",
  tenantSlug: "acme",
  tenantId: "tenant-1",
  securityVersion: 2,
  isDemoTenant: false,
};

const CUSTOMER_TOKEN = {
  principalType: "customer",
  customerId: "customer-1",
  tenantId: "tenant-1",
  tenantSlug: "acme",
  customerSecurityVersion: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("isTenantSuspended", () => {
  it("active tenant → not suspended", () => {
    expect(isTenantSuspended({ isActive: true, status: "active" })).toBe(false);
  });

  it("status 'suspended' (what platform.suspendTenant writes) → suspended even though isActive is still true", () => {
    expect(isTenantSuspended({ isActive: true, status: "suspended" })).toBe(true);
  });

  it("isActive false → suspended", () => {
    expect(isTenantSuspended({ isActive: false, status: "active" })).toBe(true);
  });

  it("demo tenant (status 'demo') is never treated as suspended", () => {
    expect(isTenantSuspended({ isActive: true, status: "demo" })).toBe(false);
  });

  it("provisioning is not a suspension (unchanged behavior)", () => {
    expect(isTenantSuspended({ isActive: true, status: "provisioning" })).toBe(false);
  });

  it("fails closed on a missing tenant row", () => {
    expect(isTenantSuspended(null)).toBe(true);
    expect(isTenantSuspended(undefined)).toBe(true);
  });
});

describe("staff session callback — live tenant suspension", () => {
  it("selects the tenant's isActive + status in the SAME user lookup (no extra query)", async () => {
    mockUserFindUnique.mockResolvedValueOnce({
      securityVersion: 2,
      isActive: true,
      tenant: { isActive: true, status: "active" },
    });
    await sessionCallback({ session: { user: {} }, token: STAFF_TOKEN });
    expect(mockUserFindUnique).toHaveBeenCalledTimes(1);
    expect(mockUserFindUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: {
        securityVersion: true,
        isActive: true,
        tenant: { select: { isActive: true, status: true } },
      },
    });
  });

  it("active tenant → session allowed and stamped tenantIsActive: true", async () => {
    mockUserFindUnique.mockResolvedValueOnce({
      securityVersion: 2,
      isActive: true,
      tenant: { isActive: true, status: "active" },
    });
    const session = await sessionCallback({ session: { user: {} }, token: STAFF_TOKEN });
    expect(session.error).toBeUndefined();
    expect(session.user.tenantIsActive).toBe(true);
    expect(session.user.id).toBe("user-1");
  });

  it("suspended tenant → SESSION_INVALIDATED + tenantIsActive: false (live session ends)", async () => {
    mockUserFindUnique.mockResolvedValueOnce({
      securityVersion: 2,
      isActive: true,
      tenant: { isActive: true, status: "suspended" },
    });
    const session = await sessionCallback({ session: { user: {} }, token: STAFF_TOKEN });
    expect(session.error).toBe("SESSION_INVALIDATED");
    expect(session.user.tenantIsActive).toBe(false);
    // Must not leak a usable staff identity on the invalidated shape.
    expect(session.user.id).toBeUndefined();
    expect(session.user.tenantId).toBeUndefined();
  });

  it("deactivated tenant (isActive false) → SESSION_INVALIDATED + tenantIsActive: false", async () => {
    mockUserFindUnique.mockResolvedValueOnce({
      securityVersion: 2,
      isActive: true,
      tenant: { isActive: false, status: "active" },
    });
    const session = await sessionCallback({ session: { user: {} }, token: STAFF_TOKEN });
    expect(session.error).toBe("SESSION_INVALIDATED");
    expect(session.user.tenantIsActive).toBe(false);
  });

  it("demo tenant session is unaffected", async () => {
    mockUserFindUnique.mockResolvedValueOnce({
      securityVersion: 1,
      isActive: true,
      tenant: { isActive: true, status: "demo" },
    });
    const session = await sessionCallback({
      session: { user: {} },
      token: { ...STAFF_TOKEN, tenantSlug: "demo", securityVersion: 1, isDemoTenant: true },
    });
    expect(session.error).toBeUndefined();
    expect(session.user.tenantIsActive).toBe(true);
    expect(session.user.isDemoTenant).toBe(true);
  });

  it("a stale securityVersion still reports session_expired semantics (no tenantIsActive:false)", async () => {
    mockUserFindUnique.mockResolvedValueOnce({
      securityVersion: 99,
      isActive: true,
      tenant: { isActive: true, status: "active" },
    });
    const session = await sessionCallback({ session: { user: {} }, token: STAFF_TOKEN });
    expect(session.error).toBe("SESSION_INVALIDATED");
    expect(session.user?.tenantIsActive).not.toBe(false);
  });
});

describe("customer (portal) jwt/session callbacks — live tenant suspension", () => {
  it("re-validation selects the tenant status in the same customer lookup", async () => {
    mockCustomerFindUnique.mockResolvedValueOnce({
      isActive: true,
      portalEnabled: true,
      customerSecurityVersion: 1,
      tenant: { isActive: true, status: "active" },
    });
    const token = await jwtCallback({ token: { ...CUSTOMER_TOKEN }, user: undefined });
    expect(mockCustomerFindUnique).toHaveBeenCalledWith({
      where: { id: "customer-1" },
      select: {
        isActive: true,
        portalEnabled: true,
        customerSecurityVersion: true,
        tenant: { select: { isActive: true, status: true } },
      },
    });
    expect(token.error).toBeUndefined();
    expect(token.tenantSuspended).toBeUndefined();
  });

  it("suspended tenant → token invalidated and flagged tenantSuspended", async () => {
    mockCustomerFindUnique.mockResolvedValueOnce({
      isActive: true,
      portalEnabled: true,
      customerSecurityVersion: 1,
      tenant: { isActive: true, status: "suspended" },
    });
    const token = await jwtCallback({ token: { ...CUSTOMER_TOKEN }, user: undefined });
    expect(token.error).toBe("SESSION_INVALIDATED");
    expect(token.tenantSuspended).toBe(true);
  });

  it("reactivated tenant clears the stale suspension flag", async () => {
    mockCustomerFindUnique.mockResolvedValueOnce({
      isActive: true,
      portalEnabled: true,
      customerSecurityVersion: 1,
      tenant: { isActive: true, status: "active" },
    });
    const token = await jwtCallback({
      token: { ...CUSTOMER_TOKEN, error: "SESSION_INVALIDATED", tenantSuspended: true },
      user: undefined,
    });
    expect(token.error).toBeUndefined();
    expect(token.tenantSuspended).toBeUndefined();
  });

  it("session callback surfaces tenantIsActive:false on a suspended-tenant customer session", async () => {
    const session = await sessionCallback({
      session: { user: {} },
      token: { ...CUSTOMER_TOKEN, error: "SESSION_INVALIDATED", tenantSuspended: true },
    });
    expect(session.error).toBe("SESSION_INVALIDATED");
    expect(session.principalType).toBe("customer");
    expect(session.user.tenantIsActive).toBe(false);
  });
});
