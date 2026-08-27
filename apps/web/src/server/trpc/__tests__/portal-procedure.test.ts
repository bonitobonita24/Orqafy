/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  createCallerFactory,
  portalProcedure,
  protectedProcedure,
} from "@/server/trpc/trpc";
import { matrixProcedure } from "@/server/trpc/middleware/matrix";
import type * as OrqafyDb from "@orqafy/db";

vi.mock("@/server/lib/rate-limit", () => ({
  rateLimiters: {
    api: { check: vi.fn() },
    auth: { check: vi.fn() },
    upload: { check: vi.fn() },
    public: { check: vi.fn() },
  },
}));

vi.mock("@orqafy/db", async () => {
  const actual = await vi.importActual<typeof OrqafyDb>("@orqafy/db");
  return {
    ...actual,
    prisma: {
      role: { findFirst: vi.fn() },
      rolePermission: { findUnique: vi.fn() },
    },
  };
});

import type { NextRequest } from "next/server";
function makeReq(): NextRequest {
  return { headers: { get: (_h: string): string | null => null } } as unknown as NextRequest;
}

function customerCtx() {
  return {
    req: makeReq(),
    userId: null,
    roles: [],
    roleId: null,
    tenantSlug: "acme",
    tenantId: "tenant-1",
    securityVersion: 0,
    isDemoTenant: false,
    session: null,
    principalType: "customer" as const,
    customerId: "customer-1",
  };
}

function staffCtx() {
  return {
    req: makeReq(),
    userId: "user-1",
    roles: ["Custom Role"],
    roleId: "role-1",
    tenantSlug: "acme",
    tenantId: "tenant-1",
    securityVersion: 1,
    isDemoTenant: false,
    session: null,
    principalType: "staff" as const,
    customerId: null,
  };
}

function unauthCtx() {
  return {
    req: makeReq(),
    userId: null,
    roles: [],
    roleId: null,
    tenantSlug: null,
    tenantId: null,
    securityVersion: 0,
    isDemoTenant: false,
    session: null,
    principalType: "staff" as const,
    customerId: null,
  };
}

function invalidatedCustomerCtx() {
  // createTRPCContext collapses an invalidated portal session to the same
  // unauthenticated shape as "never signed in" — see context.ts.
  return unauthCtx();
}

const portalRouter = createTRPCRouter({
  whoAmI: portalProcedure.query(({ ctx }) => ({ customerId: ctx.customerId, tenantId: ctx.tenantId })),
});
const createPortalCaller = createCallerFactory(portalRouter);

const protectedRouter = createTRPCRouter({
  whoAmI: protectedProcedure.query(({ ctx }) => ({ userId: ctx.userId })),
});
const createProtectedCaller = createCallerFactory(protectedRouter);

const matrixRouter = createTRPCRouter({
  invoicesView: matrixProcedure("invoices", "view").query(() => "ok" as const),
});
const createMatrixCaller = createCallerFactory(matrixRouter);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("portalProcedure", () => {
  it("accepts a customer ctx and non-null-narrows customerId/tenantId/tenantSlug", async () => {
    const caller = createPortalCaller(customerCtx());
    await expect(caller.whoAmI()).resolves.toEqual({ customerId: "customer-1", tenantId: "tenant-1" });
  });

  it("rejects a staff ctx with UNAUTHORIZED", async () => {
    const caller = createPortalCaller(staffCtx());
    await expect(caller.whoAmI()).rejects.toThrow(TRPCError);
    await expect(caller.whoAmI()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects an unauthenticated ctx with UNAUTHORIZED", async () => {
    const caller = createPortalCaller(unauthCtx());
    await expect(caller.whoAmI()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects an invalidated customer session (collapsed to unauthenticated) with UNAUTHORIZED", async () => {
    const caller = createPortalCaller(invalidatedCustomerCtx());
    await expect(caller.whoAmI()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("deny-by-default: a customer ctx cannot pass staff procedures", () => {
  it("protectedProcedure rejects a customer ctx (userId is null)", async () => {
    const caller = createProtectedCaller(customerCtx());
    await expect(caller.whoAmI()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("matrixProcedure rejects a customer ctx (userId is null, never reaches the matrix lookup)", async () => {
    const caller = createMatrixCaller(customerCtx());
    await expect(caller.invoicesView()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
