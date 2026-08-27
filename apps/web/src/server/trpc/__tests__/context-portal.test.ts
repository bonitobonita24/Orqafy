// context-portal.test.ts — createTRPCContext's customer-portal branch
// (T1.2/T1.3). Companion to context-bearer.test.ts (mobile bearer, staff-only).
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockRequireMobileBearer, mockAuth } = vi.hoisted(() => ({
  mockRequireMobileBearer: vi.fn(),
  mockAuth: vi.fn(),
}));

vi.mock("@/server/auth/mobile-bearer", () => ({
  requireMobileBearer: mockRequireMobileBearer,
}));

vi.mock("@/server/auth", () => ({
  auth: mockAuth,
}));

vi.mock("@orqafy/db", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
  },
}));

function fakeReq(): NextRequest {
  return new NextRequest("http://localhost/api/trpc/foo");
}

describe("createTRPCContext — customer-portal session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireMobileBearer.mockResolvedValue(null); // no mobile bearer in these cases
  });

  it("a customer session yields principalType:'customer', customerId set, userId null, roleId null", async () => {
    mockAuth.mockResolvedValue({
      principalType: "customer",
      customerId: "customer-1",
      user: { id: "", roles: [], roleId: "", tenantSlug: "acme", tenantId: "tenant-1" },
    } as any);

    const { createTRPCContext } = await import("../context");
    const ctx = await createTRPCContext({ req: fakeReq() });

    expect(ctx.principalType).toBe("customer");
    expect(ctx.customerId).toBe("customer-1");
    expect(ctx.userId).toBeNull();
    expect(ctx.roleId).toBeNull();
    expect(ctx.tenantSlug).toBe("acme");
    expect(ctx.tenantId).toBe("tenant-1");
  });

  it("an invalidated customer session (top-level session.error) collapses to the unauthenticated shape", async () => {
    mockAuth.mockResolvedValue({
      principalType: "customer",
      customerId: "customer-1",
      error: "SESSION_INVALIDATED",
      user: { id: "", roles: [], roleId: "", tenantSlug: "acme", tenantId: "tenant-1" },
    } as any);

    const { createTRPCContext } = await import("../context");
    const ctx = await createTRPCContext({ req: fakeReq() });

    expect(ctx.userId).toBeNull();
    expect(ctx.customerId).toBeNull();
    expect(ctx.principalType).toBe("staff"); // default/unauthenticated shape
  });

  it("an invalidated customer session WITHOUT principalType (real config error-branch shape) is still rejected — SECURITY GUARD", async () => {
    // The session callback's customer error-branch signals revocation via the
    // TOP-LEVEL session.error; a revoked session must NOT fall through to build
    // a real ctx even if principalType is absent. Guards the gap where an
    // invalidated customer could otherwise pass protectedProcedure with an
    // undefined userId.
    mockAuth.mockResolvedValue({
      error: "SESSION_INVALIDATED",
      user: { id: "should-not-be-used", tenantSlug: "acme", tenantId: "tenant-1" },
    } as any);

    const { createTRPCContext } = await import("../context");
    const ctx = await createTRPCContext({ req: fakeReq() });

    expect(ctx.userId).toBeNull();
    expect(ctx.customerId).toBeNull();
    expect(ctx.tenantId).toBeNull();
    expect(ctx.tenantSlug).toBeNull();
    expect(ctx.principalType).toBe("staff"); // collapsed to unauthenticated shape
  });

  it("a staff session still yields principalType:'staff', customerId null — REGRESSION GUARD", async () => {
    mockAuth.mockResolvedValue({
      user: {
        id: "web-user-1",
        roles: ["Tenant Admin"],
        roleId: "role-web",
        tenantSlug: "web-tenant",
        tenantId: "web-tenant-id",
        securityVersion: 5,
        isDemoTenant: false,
      },
    } as any);

    const { createTRPCContext } = await import("../context");
    const ctx = await createTRPCContext({ req: fakeReq() });

    expect(ctx.principalType).toBe("staff");
    expect(ctx.customerId).toBeNull();
    expect(ctx.userId).toBe("web-user-1");
  });

  it("no session at all -> principalType defaults to 'staff', customerId null (unauthenticated shape unchanged)", async () => {
    mockAuth.mockResolvedValue(null);

    const { createTRPCContext } = await import("../context");
    const ctx = await createTRPCContext({ req: fakeReq() });

    expect(ctx.principalType).toBe("staff");
    expect(ctx.customerId).toBeNull();
    expect(ctx.userId).toBeNull();
  });
});
