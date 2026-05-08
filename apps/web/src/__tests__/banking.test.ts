/**
 * Phase 8 Batch 2 Item 1: Module 9 Banking & Finance — FundSource CRUD
 *
 * Covers:
 *  1. fundSource.list — paginated list with isActive filter
 *  2. fundSource.byId — returns single fund source or NOT_FOUND
 *  3. fundSource.create — creates with required fields
 *  4. fundSource.update — partial update of fund source
 *  5. fundSource.toggleActive — flips isActive boolean
 */
/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Modules under test
// ---------------------------------------------------------------------------
import { bankingRouter } from "@/server/trpc/routers/banking";
import { createTRPCRouter, createCallerFactory } from "@/server/trpc/trpc";

// ---------------------------------------------------------------------------
// Mock heavy dependencies so unit tests don't need real DB / Redis
// ---------------------------------------------------------------------------
vi.mock("@orqafy/db", () => ({
  prisma: {
    fundSource: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  },
}));

// ---------------------------------------------------------------------------
// Context factory helpers
// ---------------------------------------------------------------------------
import type { NextRequest } from "next/server";

function makeReq(): NextRequest {
  return {} as NextRequest;
}

function authenticatedCtx() {
  return {
    req: makeReq(),
    userId: "user-1",
    roles: ["Administrator"],
    tenantSlug: "acme",
    tenantId: "acme-tenant-id",
    securityVersion: 1,
    isDemoTenant: false,
    session: null,
  };
}

function unauthenticatedCtx() {
  return {
    req: makeReq(),
    userId: null,
    roles: [],
    tenantSlug: null,
    tenantId: null,
    securityVersion: 0,
    isDemoTenant: false,
    session: null,
  };
}

// ---------------------------------------------------------------------------
// Test router wiring
// ---------------------------------------------------------------------------
const testRouter = createTRPCRouter({ banking: bankingRouter });
const createCaller = createCallerFactory(testRouter);

// ---------------------------------------------------------------------------
// Import mock after vi.mock hoisting
// ---------------------------------------------------------------------------
import { prisma as db } from "@orqafy/db";
const mockDb = db as unknown as {
  fundSource: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
};

// ---------------------------------------------------------------------------
// Sample fixture
// ---------------------------------------------------------------------------
const sampleFundSource = {
  id: "cuid-fs-1",
  name: "BDO Checking Account",
  type: "bank",
  bankName: "Banco de Oro",
  accountNumber: "1234567890",
  currentBalance: "50000.00",
  creditLimit: null,
  outstandingBalance: null,
  statementDueDay: null,
  loanProvider: null,
  loanPrincipal: null,
  loanBalance: null,
  loanInterestRate: null,
  currency: "PHP",
  isActive: true,
  metadata: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

// ---------------------------------------------------------------------------
// 1. fundSource.list
// ---------------------------------------------------------------------------
describe("banking.fundSource.list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns paginated fund sources for authenticated user", async () => {
    mockDb.fundSource.findMany.mockResolvedValue([sampleFundSource]);
    mockDb.fundSource.count.mockResolvedValue(1);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.banking.list({ page: 1, limit: 50 });

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(50);
    expect(mockDb.fundSource.findMany).toHaveBeenCalledOnce();
  });

  it("filters by isActive when provided", async () => {
    mockDb.fundSource.findMany.mockResolvedValue([sampleFundSource]);
    mockDb.fundSource.count.mockResolvedValue(1);

    const caller = createCaller(authenticatedCtx());
    await caller.banking.list({ page: 1, limit: 50, isActive: true });

    const findManyCall = mockDb.fundSource.findMany.mock.calls[0] as [{ where: unknown }];
    expect(findManyCall[0].where).toMatchObject({ isActive: true });
  });

  it("filters by type when provided", async () => {
    mockDb.fundSource.findMany.mockResolvedValue([sampleFundSource]);
    mockDb.fundSource.count.mockResolvedValue(1);

    const caller = createCaller(authenticatedCtx());
    await caller.banking.list({ page: 1, limit: 50, type: "bank" });

    const findManyCall = mockDb.fundSource.findMany.mock.calls[0] as [{ where: unknown }];
    expect(findManyCall[0].where).toMatchObject({ type: "bank" });
  });

  it("rejects unauthenticated requests", async () => {
    const caller = createCaller(unauthenticatedCtx());
    await expect(caller.banking.list({ page: 1, limit: 50 })).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 2. fundSource.byId
// ---------------------------------------------------------------------------
describe("banking.fundSource.byId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a fund source by id", async () => {
    mockDb.fundSource.findUnique.mockResolvedValue(sampleFundSource);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.banking.byId({ id: "cuid-fs-1" });

    expect(result.id).toBe("cuid-fs-1");
    expect(result.name).toBe("BDO Checking Account");
  });

  it("throws NOT_FOUND when fund source does not exist", async () => {
    mockDb.fundSource.findUnique.mockResolvedValue(null);

    const caller = createCaller(authenticatedCtx());
    await expect(caller.banking.byId({ id: "cuid-nonexistent" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

// ---------------------------------------------------------------------------
// 3. fundSource.create
// ---------------------------------------------------------------------------
describe("banking.fundSource.create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a fund source with required fields", async () => {
    const created = { ...sampleFundSource, id: "cuid-new" };
    mockDb.fundSource.create.mockResolvedValue(created);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.banking.create({
      name: "BDO Checking Account",
      type: "bank",
      initialBalance: 50000,
      currency: "PHP",
    });

    expect(result.id).toBe("cuid-new");
    expect(mockDb.fundSource.create).toHaveBeenCalledOnce();
  });

  it("rejects demo tenant mutations", async () => {
    const demoCaller = createCaller({
      ...authenticatedCtx(),
      isDemoTenant: true,
    });
    await expect(
      demoCaller.banking.create({
        name: "Cash",
        type: "cash_on_hand",
        initialBalance: 0,
        currency: "PHP",
      })
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 4. fundSource.update
// ---------------------------------------------------------------------------
describe("banking.fundSource.update", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates name and bankName", async () => {
    const existing = { ...sampleFundSource };
    const updated = { ...existing, name: "BDO Savings Account" };
    mockDb.fundSource.findUnique.mockResolvedValue(existing);
    mockDb.fundSource.update.mockResolvedValue(updated);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.banking.update({
      id: "cuid-fs-1",
      name: "BDO Savings Account",
    });

    expect(result.name).toBe("BDO Savings Account");
    expect(mockDb.fundSource.update).toHaveBeenCalledOnce();
  });

  it("throws NOT_FOUND when fund source does not exist", async () => {
    mockDb.fundSource.findUnique.mockResolvedValue(null);

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.banking.update({ id: "cuid-nonexistent", name: "New Name" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

// ---------------------------------------------------------------------------
// 5. fundSource.toggleActive
// ---------------------------------------------------------------------------
describe("banking.fundSource.toggleActive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("flips isActive from true to false", async () => {
    const existing = { ...sampleFundSource, isActive: true };
    const updated = { ...existing, isActive: false };
    mockDb.fundSource.findUnique.mockResolvedValue(existing);
    mockDb.fundSource.update.mockResolvedValue(updated);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.banking.toggleActive({ id: "cuid-fs-1" });

    expect(result.isActive).toBe(false);
    const updateCall = mockDb.fundSource.update.mock.calls[0] as [
      { data: { isActive: boolean } },
    ];
    expect(updateCall[0].data.isActive).toBe(false);
  });

  it("flips isActive from false to true", async () => {
    const existing = { ...sampleFundSource, isActive: false };
    const updated = { ...existing, isActive: true };
    mockDb.fundSource.findUnique.mockResolvedValue(existing);
    mockDb.fundSource.update.mockResolvedValue(updated);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.banking.toggleActive({ id: "cuid-fs-1" });

    expect(result.isActive).toBe(true);
  });
});
