/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
/**
 * Client tenant parity (L3 RBAC + L5 AuditLog + tenant-scope isolation)
 *
 * Proves:
 *  1. client.byId throws NOT_FOUND when customer belongs to tenant-B but ctx is tenant-A
 *  2. client.byId returns the customer when tenantId matches ctx
 *  3. client.create injects tenantId from ctx (not from input) + writes audit log
 *  4. client.update throws NOT_FOUND for cross-tenant IDOR attempt
 *  5. client.update writes audit log on success
 *  6. client.delete throws NOT_FOUND for cross-tenant IDOR attempt
 *  7. client.delete writes audit log on success
 *  8. writeProcedure (demo guard) blocks create/update/delete on demo tenant
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type * as OrqafyDb from "@orqafy/db";

// ── DB mock (hoisted so vi.mock factory can reference) ────────────────────────
const {
  mockCustomerFindFirst,
  mockCustomerFindMany,
  mockCustomerCreate,
  mockCustomerUpdate,
  mockCustomerDelete,
  mockCustomerCount,
  mockAuditLogCreate,
  mockRoleFindFirst,
} = vi.hoisted(() => ({
  mockCustomerFindFirst: vi.fn(),
  mockCustomerFindMany: vi.fn(),
  mockCustomerCreate: vi.fn(),
  mockCustomerUpdate: vi.fn(),
  mockCustomerDelete: vi.fn(),
  mockCustomerCount: vi.fn(),
  mockAuditLogCreate: vi.fn(),
  mockRoleFindFirst: vi.fn(),
}));

// Router migrated to the data-driven `role_permissions` matrix (feature key
// "crm") — matrixMiddleware resolves the caller's role via role.findFirst.
// Every ctx below uses roleId "role-1" and role name "Platform Owner" so the
// matrix bypasses entirely (this suite proves tenant-scoping business logic,
// not matrix grants — see client-matrix.test.ts for matrix grant/deny
// coverage). Keep the real `hasPermission` resolver (it takes prisma as an
// argument) via importActual — only mock the prisma client calls it makes.
vi.mock("@orqafy/db", async () => {
  const actual = await vi.importActual<typeof OrqafyDb>("@orqafy/db");
  // mockDb is the object passed INTO the $transaction callback (represents the tx client).
  const mockDb = {
    customer: {
      findFirst: mockCustomerFindFirst,
      findMany: mockCustomerFindMany,
      create: mockCustomerCreate,
      update: mockCustomerUpdate,
      delete: mockCustomerDelete,
      count: mockCustomerCount,
    },
    auditLog: { create: mockAuditLogCreate },
    role: { findFirst: mockRoleFindFirst },
    rolePermission: { findUnique: vi.fn() },
  };
  return {
    ...actual,
    prisma: {
      ...mockDb,
      // $transaction passes mockDb as the "tx" argument so the router's tx.customer.xxx calls
      // resolve to the same mocks as prisma.customer.xxx calls.
      $transaction: vi.fn((fn: any) => fn(mockDb)),
    },
    writeAuditLog: async (tx: any, entry: any) => {
      await tx.auditLog.create({ data: entry });
    },
  };
});

vi.mock("@/server/lib/rate-limit", () => ({
  rateLimiters: { api: { check: vi.fn() }, public: { check: vi.fn() } },
}));

vi.mock("@/server/lib/sanitize", () => ({
  sanitizePlainText: (s: string) => s,
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────
import { clientRouter } from "@/server/trpc/routers/client";
import { createTRPCRouter, createCallerFactory } from "@/server/trpc/trpc";
import type { NextRequest } from "next/server";

const testRouter = createTRPCRouter({ clients: clientRouter });
const createCaller = createCallerFactory(testRouter);

function makeReq(): NextRequest {
  return {} as NextRequest;
}

function ctxForTenant(tenantId: string, isDemoTenant = false) {
  return {
    req: makeReq(),
    userId: "user-1",
    roles: ["Administrator"] as string[],
    roleId: "role-1",
    tenantSlug: "test",
    tenantId,
    securityVersion: 1,
    isDemoTenant,
    session: null,
  };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CLIENT_A = {
  id: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
  tenantId: "tenant-A",
  firstName: "Alice",
  lastName: "Bautista",
  companyName: "Acme Corp",
  email: "alice@acme.com",
  phone: null,
  address: null,
  city: null,
  province: null,
  postalCode: null,
  taxId: null,
  notes: null,
  isActive: true,
  portalEnabled: false,
  portalEmail: null,
  portalPasswordHash: null,
  country: "PH",
  tier: "regular",
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Client tenant parity (L3 RBAC + L5 AuditLog + tenant-scope isolation)", () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    // Re-wire $transaction after reset so it always passes mockDb to the callback.
    const { prisma } = await import("@orqafy/db");
    (prisma as any).$transaction.mockImplementation((fn: any) => {
      const mockDb = {
        customer: {
          findFirst: mockCustomerFindFirst,
          findMany: mockCustomerFindMany,
          create: mockCustomerCreate,
          update: mockCustomerUpdate,
          delete: mockCustomerDelete,
          count: mockCustomerCount,
        },
        auditLog: { create: mockAuditLogCreate },
      };
      return fn(mockDb);
    });
    // Every test's caller resolves to a "Platform Owner" role, which
    // bypasses the "crm" matrix entirely (tenant-rbac-standard.md §4) — this
    // suite exercises tenant-scoping business logic, not matrix grant/deny
    // behaviour (see client-matrix.test.ts for that coverage).
    mockRoleFindFirst.mockResolvedValue({
      id: "role-1",
      tenantId: "tenant-A",
      name: "Platform Owner",
    });
  });

  // ── 1. byId scope ────────────────────────────────────────────────────────────
  it("client.byId throws NOT_FOUND when customer belongs to a different tenant", async () => {
    mockCustomerFindFirst.mockResolvedValueOnce(null);

    const caller = createCaller(ctxForTenant("tenant-A"));

    await expect(
      caller.clients.byId({ id: CLIENT_A.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("client.byId returns customer when tenantId matches ctx", async () => {
    mockCustomerFindFirst.mockResolvedValueOnce(CLIENT_A);

    const caller = createCaller(ctxForTenant("tenant-A"));
    const result = await caller.clients.byId({ id: CLIENT_A.id });

    expect(result).toMatchObject({ id: CLIENT_A.id, tenantId: "tenant-A" });
    const callArg = mockCustomerFindFirst.mock.calls[0]![0];
    expect(callArg.where.tenantId).toBe("tenant-A");
  });

  // ── 2. create: tenantId injection + audit log ─────────────────────────────────
  it("client.create injects tenantId from ctx into db.customer.create", async () => {
    mockCustomerCreate.mockResolvedValueOnce(CLIENT_A);
    mockAuditLogCreate.mockResolvedValueOnce({});

    const caller = createCaller(ctxForTenant("tenant-A"));
    await caller.clients.create({ firstName: "Alice", lastName: "Bautista" });

    expect(mockCustomerCreate).toHaveBeenCalledOnce();
    const callArg = mockCustomerCreate.mock.calls[0]![0];
    expect(callArg.data.tenantId).toBe("tenant-A");
  });

  it("client.create writes audit log with action CREATE", async () => {
    mockCustomerCreate.mockResolvedValueOnce(CLIENT_A);
    mockAuditLogCreate.mockResolvedValueOnce({});

    const caller = createCaller(ctxForTenant("tenant-A"));
    await caller.clients.create({ firstName: "Alice", lastName: "Bautista" });

    expect(mockAuditLogCreate).toHaveBeenCalledOnce();
    const auditArg = mockAuditLogCreate.mock.calls[0]![0];
    expect(auditArg.data.action).toBe("CREATE");
    expect(auditArg.data.entity).toBe("Customer");
    expect(auditArg.data.entityId).toBe(CLIENT_A.id);
  });

  // ── 3. update: IDOR guard + audit log ─────────────────────────────────────────
  it("client.update throws NOT_FOUND for cross-tenant IDOR attempt", async () => {
    // findFirst returns null — client does not belong to tenant-A
    mockCustomerFindFirst.mockResolvedValueOnce(null);

    const caller = createCaller(ctxForTenant("tenant-A"));

    await expect(
      caller.clients.update({ id: CLIENT_A.id, firstName: "Evil" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(mockCustomerUpdate).not.toHaveBeenCalled();
  });

  it("client.update writes audit log on success", async () => {
    mockCustomerFindFirst.mockResolvedValueOnce(CLIENT_A); // IDOR check
    const updated = { ...CLIENT_A, firstName: "Alicia" };
    mockCustomerUpdate.mockResolvedValueOnce(updated);
    mockAuditLogCreate.mockResolvedValueOnce({});

    const caller = createCaller(ctxForTenant("tenant-A"));
    await caller.clients.update({ id: CLIENT_A.id, firstName: "Alicia" });

    expect(mockCustomerUpdate).toHaveBeenCalledOnce();
    expect(mockAuditLogCreate).toHaveBeenCalledOnce();
    const auditArg = mockAuditLogCreate.mock.calls[0]![0];
    expect(auditArg.data.action).toBe("UPDATE");
    expect(auditArg.data.entity).toBe("Customer");
    expect(auditArg.data.entityId).toBe(CLIENT_A.id);
  });

  // ── 4. delete: IDOR guard + audit log ─────────────────────────────────────────
  it("client.delete throws NOT_FOUND for cross-tenant IDOR attempt", async () => {
    mockCustomerFindFirst.mockResolvedValueOnce(null);

    const caller = createCaller(ctxForTenant("tenant-A"));

    await expect(
      caller.clients.delete({ id: CLIENT_A.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(mockCustomerDelete).not.toHaveBeenCalled();
  });

  it("client.delete writes audit log on success", async () => {
    mockCustomerFindFirst.mockResolvedValueOnce(CLIENT_A); // IDOR check
    mockCustomerDelete.mockResolvedValueOnce(CLIENT_A);
    mockAuditLogCreate.mockResolvedValueOnce({});

    const caller = createCaller(ctxForTenant("tenant-A"));
    await caller.clients.delete({ id: CLIENT_A.id });

    expect(mockCustomerDelete).toHaveBeenCalledOnce();
    expect(mockAuditLogCreate).toHaveBeenCalledOnce();
    const auditArg = mockAuditLogCreate.mock.calls[0]![0];
    expect(auditArg.data.action).toBe("DELETE");
    expect(auditArg.data.entity).toBe("Customer");
    expect(auditArg.data.entityId).toBe(CLIENT_A.id);
  });

  // ── 5. Demo tenant guard ──────────────────────────────────────────────────────
  it("client.create throws FORBIDDEN on demo tenant", async () => {
    const caller = createCaller(ctxForTenant("tenant-A", true /* isDemoTenant */));

    await expect(
      caller.clients.create({ firstName: "Test", lastName: "User" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("client.update throws FORBIDDEN on demo tenant", async () => {
    const caller = createCaller(ctxForTenant("tenant-A", true /* isDemoTenant */));

    await expect(
      caller.clients.update({ id: CLIENT_A.id, firstName: "Test" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("client.delete throws FORBIDDEN on demo tenant", async () => {
    const caller = createCaller(ctxForTenant("tenant-A", true /* isDemoTenant */));

    await expect(
      caller.clients.delete({ id: CLIENT_A.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
