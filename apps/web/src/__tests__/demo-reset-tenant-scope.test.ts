/**
 * Regression test for AIEF audit M3 P0: demoRouter.reset previously ran
 * `deleteMany({})` with an EMPTY where-clause on the global unscoped Prisma
 * client, trusting a schema-per-tenant `SET search_path` that is NOT active at
 * runtime (runtime isolation is explicit `tenantId` filtering on the shared
 * `public` schema). A demo-tenant session could therefore wipe EVERY tenant's
 * invoices/customers/employees/payroll/projects platform-wide.
 *
 * This test asserts the fix:
 *   - every deleteMany is scoped with `where: { tenantId }` from the session ctx
 *   - a non-demo session is rejected with FORBIDDEN (no deletes run)
 *   - a demo session with a null tenantId is rejected (no deletes run)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// --- Mock the db BEFORE importing the router ------------------------------
const MODELS = [
  "invoice",
  "expense",
  "jobOrderPart",
  "jobOrder",
  "payslip",
  "payroll",
  "employee",
  "task",
  "project",
  "customer",
] as const;
type Model = (typeof MODELS)[number];
type DelMock = { deleteMany: ReturnType<typeof vi.fn> };

// Record<union, V> keys are required, so tx[m] is non-optional under
// noUncheckedIndexedAccess.
const tx = Object.fromEntries(
  MODELS.map((m) => [m, { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) }]),
) as Record<Model, DelMock>;

vi.mock("@orqafy/db", () => ({
  prisma: {
    $transaction: vi.fn((cb: (t: Record<Model, DelMock>) => Promise<unknown>) => cb(tx)),
  },
}));

import { demoRouter } from "@/server/trpc/routers/demo";
import { createTRPCRouter, createCallerFactory } from "@/server/trpc/trpc";

function makeReq(): NextRequest {
  return {} as NextRequest;
}

function ctx(opts: { isDemoTenant: boolean; tenantId: string | null }) {
  return {
    req: makeReq(),
    userId: "user-1",
    roles: ["Admin"],
    tenantSlug: "demo",
    tenantId: opts.tenantId,
    securityVersion: 1,
    isDemoTenant: opts.isDemoTenant,
    session: null,
  };
}

const router = createTRPCRouter({ demo: demoRouter });

beforeEach(() => {
  for (const m of MODELS) tx[m].deleteMany.mockClear();
});

describe("demoRouter.reset tenant scoping", () => {
  it("scopes EVERY deleteMany with where.tenantId from the session", async () => {
    const caller = createCallerFactory(router)(
      ctx({ isDemoTenant: true, tenantId: "demo-tenant-id" }),
    );
    await expect(caller.demo.reset()).resolves.toMatchObject({ success: true });

    for (const m of MODELS) {
      expect(tx[m].deleteMany).toHaveBeenCalledTimes(1);
      expect(tx[m].deleteMany).toHaveBeenCalledWith({
        where: { tenantId: "demo-tenant-id" },
      });
      // The regression itself: never an empty (all-tenant) delete.
      expect(tx[m].deleteMany).not.toHaveBeenCalledWith({});
    }
  });

  it("rejects a non-demo session with FORBIDDEN and deletes nothing", async () => {
    const caller = createCallerFactory(router)(
      ctx({ isDemoTenant: false, tenantId: "real-tenant-id" }),
    );
    await expect(caller.demo.reset()).rejects.toMatchObject({ code: "FORBIDDEN" });
    for (const m of MODELS) expect(tx[m].deleteMany).not.toHaveBeenCalled();
  });

  it("rejects a demo session with a null tenantId and deletes nothing", async () => {
    const caller = createCallerFactory(router)(
      ctx({ isDemoTenant: true, tenantId: null }),
    );
    await expect(caller.demo.reset()).rejects.toMatchObject({ code: "FORBIDDEN" });
    for (const m of MODELS) expect(tx[m].deleteMany).not.toHaveBeenCalled();
  });
});
