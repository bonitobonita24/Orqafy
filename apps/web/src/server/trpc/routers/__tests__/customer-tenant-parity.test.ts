/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
/**
 * K-prime Extended — CRM customer tenant parity
 *
 * Proves:
 *  1. customerById throws NOT_FOUND when customer belongs to tenant-B but ctx is tenant-A
 *  2. customerById returns customer when tenantId matches ctx
 *  3. customerCreate injects tenantId from ctx (not from input)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── DB mock (hoisted so vi.mock factory can reference) ────────────────────────
const { mockCustomerCreate, mockCustomerFindUnique, mockAuditLogCreate } = vi.hoisted(() => ({
  mockCustomerCreate: vi.fn(),
  mockCustomerFindUnique: vi.fn(),
  mockAuditLogCreate: vi.fn(),
}));

vi.mock("@orqafy/db", () => {
  const mockDb = {
    customer: {
      findUnique: mockCustomerFindUnique,
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: mockCustomerCreate,
      update: vi.fn(),
      count: vi.fn(),
    },
    auditLog: { create: mockAuditLogCreate },
  };
  return {
    prisma: {
      ...mockDb,
      $transaction: vi.fn((fn: any) => fn(mockDb)),
    },
    writeAuditLog: async (tx: any, entry: any) => { await tx.auditLog.create({ data: entry }); },
  };
});

vi.mock("@/server/lib/rate-limit", () => ({
  rateLimiters: { api: { check: vi.fn() }, public: { check: vi.fn() } },
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────
import { crmRouter } from "@/server/trpc/routers/crm";
import { createTRPCRouter, createCallerFactory } from "@/server/trpc/trpc";
import type { NextRequest } from "next/server";

const testRouter = createTRPCRouter({ crm: crmRouter });
const createCaller = createCallerFactory(testRouter);

function makeReq(): NextRequest {
  return {} as NextRequest;
}

function ctxForTenant(tenantId: string) {
  return {
    req: makeReq(),
    userId: "user-1",
    roles: ["Administrator"] as string[],
    tenantSlug: "test",
    tenantId,
    securityVersion: 1,
    isDemoTenant: false,
    session: null,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Customer tenant parity (K-prime Extended / CRM IDOR closure)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("customerById throws NOT_FOUND when customer belongs to a different tenant", async () => {
    // Customer in tenant-B — ctx is tenant-A
    mockCustomerFindUnique.mockResolvedValueOnce({
      id: "customer-B",
      tenantId: "tenant-B",
      firstName: "X",
      lastName: "Y",
    });

    const caller = createCaller(ctxForTenant("tenant-A"));

    await expect(caller.crm.customerById({ id: "customer-B" })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Customer not found",
    });
  });

  it("customerById returns customer when tenantId matches ctx", async () => {
    const customer = {
      id: "customer-1",
      tenantId: "tenant-A",
      firstName: "Alice",
      lastName: "Smith",
    };
    mockCustomerFindUnique.mockResolvedValueOnce(customer);

    const caller = createCaller(ctxForTenant("tenant-A"));
    const result = await caller.crm.customerById({ id: "customer-1" });

    expect(result).toEqual(customer);
  });

  it("customerCreate injects tenantId from ctx into db.customer.create", async () => {
    const createdCustomer = {
      id: "customer-new",
      tenantId: "tenant-A",
      firstName: "Test",
      lastName: "Customer",
      email: null,
      phone: null,
      company: null,
      notes: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockCustomerCreate.mockResolvedValueOnce(createdCustomer);

    const caller = createCaller(ctxForTenant("tenant-A"));
    await caller.crm.customerCreate({ firstName: "Test", lastName: "Customer" });

    expect(mockCustomerCreate).toHaveBeenCalledOnce();
    const callArg = mockCustomerCreate.mock.calls[0]![0];
    expect(callArg.data.tenantId).toBe("tenant-A");
  });

  it("customerCreate writes an audit log row with action CREATE and entity Customer", async () => {
    const createdCustomer = {
      id: "customer-audit",
      tenantId: "tenant-A",
      firstName: "Audit",
      lastName: "Test",
      email: null,
      phone: null,
      company: null,
      notes: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockCustomerCreate.mockResolvedValueOnce(createdCustomer);

    const caller = createCaller(ctxForTenant("tenant-A"));
    await caller.crm.customerCreate({ firstName: "Audit", lastName: "Test" });

    expect(mockAuditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "CREATE", entity: "Customer" }),
      }),
    );
  });
});
