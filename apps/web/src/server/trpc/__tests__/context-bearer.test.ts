// context-bearer.test.ts — createTRPCContext mobile Bearer JWT auth source
// (feat/trpc-bearer). Covers:
//   (a) valid bearer -> ctx populated, reaches protectedProcedure
//   (b) invalid/expired bearer -> falls through to unauthenticated (never throws)
//   (c) stale securityVersion -> rejected (treated as unauthenticated)
//   (d) deactivated user -> rejected
//   (e) no bearer header -> existing NextAuth cookie path unchanged
//   (f) both bearer + cookie present -> bearer wins (precedence)
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { TRPCError } from "@trpc/server";

const { mockRequireMobileBearer, mockAuth, mockUserFindUnique } = vi.hoisted(() => ({
  mockRequireMobileBearer: vi.fn(),
  mockAuth: vi.fn(),
  mockUserFindUnique: vi.fn(),
}));

vi.mock("@/server/auth/mobile-bearer", () => ({
  requireMobileBearer: mockRequireMobileBearer,
}));

vi.mock("@/server/auth", () => ({
  auth: mockAuth,
}));

vi.mock("@orqafy/db", () => ({
  prisma: {
    user: { findUnique: mockUserFindUnique },
  },
}));

const BEARER_PAYLOAD = {
  userId: "user-1",
  tenantId: "tenant-1",
  tenantSlug: "acme",
  roles: ["Employee"],
  securityVersion: 2,
  type: "access" as const,
};

function fakeReq(): NextRequest {
  return new NextRequest("http://localhost/api/trpc/foo");
}

describe("createTRPCContext — mobile Bearer JWT auth source", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("valid bearer token -> ctx populated with userId/roles/tenantSlug/tenantId/isDemoTenant, reaches protectedProcedure", async () => {
    mockRequireMobileBearer.mockResolvedValue(BEARER_PAYLOAD);
    mockUserFindUnique.mockResolvedValue({
      securityVersion: 2,
      isActive: true,
      roleId: "role-1",
    });

    const { createTRPCContext } = await import("../context");
    const ctx = await createTRPCContext({ req: fakeReq() });

    expect(ctx.userId).toBe("user-1");
    expect(ctx.roles).toEqual(["Employee"]);
    expect(ctx.roleId).toBe("role-1");
    expect(ctx.tenantSlug).toBe("acme");
    expect(ctx.tenantId).toBe("tenant-1");
    expect(ctx.securityVersion).toBe(2);
    expect(ctx.isDemoTenant).toBe(false);
    expect(mockAuth).not.toHaveBeenCalled();

    // Reaches protectedProcedure with correct ctx (mirrors trpc.ts's own guard).
    const { protectedProcedure, createTRPCRouter, createCallerFactory } = await import("../trpc");
    const router = createTRPCRouter({
      whoAmI: protectedProcedure.query(({ ctx: c }) => ({
        userId: c.userId,
        tenantId: c.tenantId,
      })),
    });
    const caller = createCallerFactory(router)(ctx);
    await expect(caller.whoAmI()).resolves.toEqual({ userId: "user-1", tenantId: "tenant-1" });
  });

  it("demo tenant bearer token -> isDemoTenant derived the same way as the cookie path (tenantSlug === 'demo')", async () => {
    mockRequireMobileBearer.mockResolvedValue({ ...BEARER_PAYLOAD, tenantSlug: "demo" });
    mockUserFindUnique.mockResolvedValue({
      securityVersion: 2,
      isActive: true,
      roleId: "role-1",
    });

    const { createTRPCContext } = await import("../context");
    const ctx = await createTRPCContext({ req: fakeReq() });

    expect(ctx.isDemoTenant).toBe(true);
  });

  it("expired/invalid bearer (requireMobileBearer returns null) -> falls through to cookie path, no DB lookup", async () => {
    mockRequireMobileBearer.mockResolvedValue(null);
    mockAuth.mockResolvedValue(null);

    const { createTRPCContext } = await import("../context");
    const ctx = await createTRPCContext({ req: fakeReq() });

    expect(mockUserFindUnique).not.toHaveBeenCalled();
    expect(ctx.userId).toBeNull();
    expect(ctx.tenantSlug).toBeNull();
  });

  it("stale securityVersion (DB value differs from token claim) -> rejected, falls through to unauthenticated", async () => {
    mockRequireMobileBearer.mockResolvedValue(BEARER_PAYLOAD);
    mockUserFindUnique.mockResolvedValue({
      securityVersion: 3, // DB bumped since token was minted (role/tenant/password change)
      isActive: true,
      roleId: "role-1",
    });
    mockAuth.mockResolvedValue(null);

    const { createTRPCContext } = await import("../context");
    const ctx = await createTRPCContext({ req: fakeReq() });

    expect(ctx.userId).toBeNull();

    // protectedProcedure rejects with UNAUTHORIZED, never a context-build-time throw.
    const { protectedProcedure, createTRPCRouter, createCallerFactory } = await import("../trpc");
    const router = createTRPCRouter({
      whoAmI: protectedProcedure.query(() => "ok"),
    });
    const caller = createCallerFactory(router)(ctx);
    await expect(caller.whoAmI()).rejects.toThrow(TRPCError);
  });

  it("deactivated user (DB isActive: false) -> rejected, falls through to unauthenticated", async () => {
    mockRequireMobileBearer.mockResolvedValue(BEARER_PAYLOAD);
    mockUserFindUnique.mockResolvedValue({
      securityVersion: 2,
      isActive: false,
      roleId: "role-1",
    });
    mockAuth.mockResolvedValue(null);

    const { createTRPCContext } = await import("../context");
    const ctx = await createTRPCContext({ req: fakeReq() });

    expect(ctx.userId).toBeNull();
  });

  it("DB user not found (deleted after token mint) -> rejected, falls through to unauthenticated", async () => {
    mockRequireMobileBearer.mockResolvedValue(BEARER_PAYLOAD);
    mockUserFindUnique.mockResolvedValue(null);
    mockAuth.mockResolvedValue(null);

    const { createTRPCContext } = await import("../context");
    const ctx = await createTRPCContext({ req: fakeReq() });

    expect(ctx.userId).toBeNull();
  });

  it("no bearer header -> existing NextAuth cookie session path is UNCHANGED", async () => {
    mockRequireMobileBearer.mockResolvedValue(null);
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

    expect(ctx.userId).toBe("web-user-1");
    expect(ctx.tenantSlug).toBe("web-tenant");
    expect(ctx.roleId).toBe("role-web");
    expect(ctx.session).not.toBeNull();
  });

  it("both a valid bearer AND a cookie session present -> bearer wins (precedence), auth() never called", async () => {
    mockRequireMobileBearer.mockResolvedValue(BEARER_PAYLOAD);
    mockUserFindUnique.mockResolvedValue({
      securityVersion: 2,
      isActive: true,
      roleId: "role-1",
    });
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

    expect(ctx.userId).toBe("user-1"); // bearer identity, not the cookie session's
    expect(mockAuth).not.toHaveBeenCalled();
  });
});
