// context-tenant-suspension.test.ts — ORQ-38. tRPC is excluded from the
// middleware matcher, so createTRPCContext is the gate for /api/trpc. A
// suspended tenant must stop API calls on live sessions (cookie + mobile
// bearer), not only page loads.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { TRPCContext } from "../context";

const { mockRequireMobileBearer, mockAuth, mockUserFindUnique } = vi.hoisted(() => ({
  mockRequireMobileBearer: vi.fn(),
  mockAuth: vi.fn(),
  mockUserFindUnique: vi.fn(),
}));

vi.mock("@/server/auth/mobile-bearer", () => ({ requireMobileBearer: mockRequireMobileBearer }));
vi.mock("@/server/auth", () => ({ auth: mockAuth }));
vi.mock("@orqafy/db", () => ({ prisma: { user: { findUnique: mockUserFindUnique } } }));

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

async function callers(ctx: TRPCContext) {
  const { protectedProcedure, portalProcedure, createTRPCRouter, createCallerFactory } =
    await import("../trpc");
  const router = createTRPCRouter({
    staff: protectedProcedure.query(() => "ok"),
    portal: portalProcedure.query(() => "ok"),
  });
  return createCallerFactory(router)(ctx);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createTRPCContext — suspended tenant (ORQ-38)", () => {
  it("staff cookie session invalidated for a suspended tenant → unauthenticated; protectedProcedure UNAUTHORIZED", async () => {
    mockRequireMobileBearer.mockResolvedValue(null);
    // Exact shape config.ts's session callback returns for a suspended tenant.
    mockAuth.mockResolvedValue({ user: { tenantIsActive: false }, error: "SESSION_INVALIDATED" });

    const { createTRPCContext } = await import("../context");
    const ctx = await createTRPCContext({ req: fakeReq() });
    expect(ctx.userId).toBeNull();
    expect(ctx.tenantId).toBeNull();

    const caller = await callers(ctx);
    await expect(caller.staff()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("customer portal session invalidated for a suspended tenant → portalProcedure UNAUTHORIZED", async () => {
    mockRequireMobileBearer.mockResolvedValue(null);
    mockAuth.mockResolvedValue({
      user: { tenantIsActive: false },
      principalType: "customer",
      error: "SESSION_INVALIDATED",
    });

    const { createTRPCContext } = await import("../context");
    const ctx = await createTRPCContext({ req: fakeReq() });
    expect(ctx.customerId).toBeNull();

    const caller = await callers(ctx);
    await expect(caller.portal()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("mobile bearer: tenant suspended → bearer rejected (same user lookup, tenant joined)", async () => {
    mockRequireMobileBearer.mockResolvedValue(BEARER_PAYLOAD);
    mockUserFindUnique.mockResolvedValue({
      securityVersion: 2,
      isActive: true,
      roleId: "role-1",
      tenant: { isActive: true, status: "suspended" },
    });
    mockAuth.mockResolvedValue(null);

    const { createTRPCContext } = await import("../context");
    const ctx = await createTRPCContext({ req: fakeReq() });

    expect(mockUserFindUnique).toHaveBeenCalledTimes(1);
    expect(mockUserFindUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: {
        securityVersion: true,
        isActive: true,
        roleId: true,
        tenant: { select: { isActive: true, status: true } },
      },
    });
    expect(ctx.userId).toBeNull();
    const caller = await callers(ctx);
    await expect(caller.staff()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("mobile bearer: active tenant → allowed", async () => {
    mockRequireMobileBearer.mockResolvedValue(BEARER_PAYLOAD);
    mockUserFindUnique.mockResolvedValue({
      securityVersion: 2,
      isActive: true,
      roleId: "role-1",
      tenant: { isActive: true, status: "active" },
    });

    const { createTRPCContext } = await import("../context");
    const ctx = await createTRPCContext({ req: fakeReq() });
    expect(ctx.userId).toBe("user-1");
    const caller = await callers(ctx);
    await expect(caller.staff()).resolves.toBe("ok");
  });

  it("mobile bearer: demo tenant (status 'demo') → allowed, never treated as suspended", async () => {
    mockRequireMobileBearer.mockResolvedValue({ ...BEARER_PAYLOAD, tenantSlug: "demo" });
    mockUserFindUnique.mockResolvedValue({
      securityVersion: 2,
      isActive: true,
      roleId: "role-1",
      tenant: { isActive: true, status: "demo" },
    });

    const { createTRPCContext } = await import("../context");
    const ctx = await createTRPCContext({ req: fakeReq() });
    expect(ctx.userId).toBe("user-1");
    expect(ctx.isDemoTenant).toBe(true);
  });

  it("active staff cookie session (tenantIsActive: true) → unchanged, allowed", async () => {
    mockRequireMobileBearer.mockResolvedValue(null);
    mockAuth.mockResolvedValue({
      principalType: "staff",
      user: {
        id: "web-user-1",
        roles: ["Tenant Admin"],
        roleId: "role-web",
        tenantSlug: "acme",
        tenantId: "tenant-1",
        securityVersion: 5,
        isDemoTenant: false,
        tenantIsActive: true,
      },
    });

    const { createTRPCContext } = await import("../context");
    const ctx = await createTRPCContext({ req: fakeReq() });
    const caller = await callers(ctx);
    await expect(caller.staff()).resolves.toBe("ok");
  });
});
