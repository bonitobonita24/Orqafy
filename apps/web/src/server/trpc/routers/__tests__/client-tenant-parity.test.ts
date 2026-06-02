/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
/**
 * K-prime closure — Client tenant parity
 *
 * Proves:
 *  1. client.byId throws NOT_FOUND when customer belongs to tenant-B but ctx is tenant-A
 *  2. client.byId returns the customer when tenantId matches ctx
 *  3. client.create injects tenantId from ctx (not from input)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── DB mock (hoisted so vi.mock factory can reference) ────────────────────────
const { mockCustomerFindFirst, mockCustomerCreate } = vi.hoisted(() => ({
  mockCustomerFindFirst: vi.fn(),
  mockCustomerCreate: vi.fn(),
}));

vi.mock("@orqafy/db", () => ({
  prisma: {
    customer: {
      findFirst: mockCustomerFindFirst,
      findMany: vi.fn(),
      create: mockCustomerCreate,
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
  },
}));

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

const testRouter = createTRPCRouter({ client: clientRouter });
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

describe("Client tenant parity (K-prime closure)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("client.byId throws NOT_FOUND when customer belongs to a different tenant", async () => {
    // findFirst returns null — customer not found for tenant-A (belongs to tenant-B)
    mockCustomerFindFirst.mockResolvedValueOnce(null);

    const caller = createCaller(ctxForTenant("tenant-A"));

    await expect(
      caller.client.byId({ id: "clxxxxxxxxxxxxxxxxxxxxxxxxx" })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("client.byId returns customer when tenantId matches ctx", async () => {
    const customer = {
      id: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
      tenantId: "tenant-A",
      firstName: "Test",
      lastName: "User",
      companyName: null,
      email: null,
      phone: null,
      address: null,
      city: null,
      province: null,
      postalCode: null,
      taxId: null,
      notes: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockCustomerFindFirst.mockResolvedValueOnce(customer);

    const caller = createCaller(ctxForTenant("tenant-A"));
    const result = await caller.client.byId({ id: "clxxxxxxxxxxxxxxxxxxxxxxxxx" });

    expect(result).toEqual(customer);
  });

  it("client.create injects tenantId from ctx into db.customer.create", async () => {
    const createdCustomer = {
      id: "clyyyyyyyyyyyyyyyyyyyyyyyyyy",
      tenantId: "tenant-A",
      firstName: "Test",
      lastName: "User",
      companyName: null,
      email: null,
      phone: null,
      address: null,
      city: null,
      province: null,
      postalCode: null,
      taxId: null,
      notes: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockCustomerCreate.mockResolvedValueOnce(createdCustomer);

    const caller = createCaller(ctxForTenant("tenant-A"));
    await caller.client.create({ firstName: "Test", lastName: "User" });

    expect(mockCustomerCreate).toHaveBeenCalledOnce();
    const callArg = mockCustomerCreate.mock.calls[0]![0];
    expect(callArg.data.tenantId).toBe("tenant-A");
  });
});
