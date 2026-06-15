/**
 * Phase 8 Batch 3 Item 1: Module 12 Accounting Phase 1
 *
 * Covers:
 *  1. account.list — paginated list with type/isActive filters
 *  2. account.byId — returns single account or NOT_FOUND
 *  3. account.create — creates with required fields
 *  4. account.update — partial update
 *  5. account.toggleActive — flips isActive boolean
 *  6. journalEntry.list — paginated list with status/fiscalYearId filters
 *  7. journalEntry.byId — returns single entry or NOT_FOUND
 *  8. journalEntry.create — creates with balanced lines
 *  9. journalEntry.post — transitions draft → posted
 * 10. journalEntry.reverse — creates counter-entry, marks original void
 * 11. fiscalYear.list — paginated list
 * 12. fiscalYear.create — creates new fiscal year
 * 13. taxRate.list — paginated list
 * 14. taxRate.create — creates new tax rate
 */
/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Modules under test
// ---------------------------------------------------------------------------
import { accountingRouter } from "@/server/trpc/routers/accounting";
import { createTRPCRouter, createCallerFactory } from "@/server/trpc/trpc";

// ---------------------------------------------------------------------------
// Mock heavy dependencies so unit tests don't need real DB / Redis
// ---------------------------------------------------------------------------
vi.mock("@orqafy/db", () => {
  const accountCreate = vi.fn();
  const accountUpdate = vi.fn();
  const journalEntryCreate = vi.fn();
  const journalEntryUpdate = vi.fn();
  const journalLineDeleteMany = vi.fn();
  const mockTx = {
    account: { create: accountCreate, update: accountUpdate },
    journalEntry: { create: journalEntryCreate, update: journalEntryUpdate },
    journalLine: { deleteMany: journalLineDeleteMany },
    auditLog: { create: vi.fn() },
  };
  return {
    prisma: {
      account: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: accountCreate,
        update: accountUpdate,
        count: vi.fn(),
      },
      journalEntry: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn().mockResolvedValue(null), // not already reversed by default
        create: journalEntryCreate,
        update: journalEntryUpdate,
        count: vi.fn(),
      },
      journalLine: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
      fiscalYear: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        count: vi.fn(),
      },
      taxRate: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        count: vi.fn(),
      },
      $transaction: vi.fn().mockImplementation(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
    },
    writeAuditLog: vi.fn(),
  };
});

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
const testRouter = createTRPCRouter({ accounting: accountingRouter });
const createCaller = createCallerFactory(testRouter);

// ---------------------------------------------------------------------------
// Import mock after vi.mock hoisting
// ---------------------------------------------------------------------------
import { prisma as db } from "@orqafy/db";
const mockDb = db as unknown as {
  account: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  journalEntry: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  fiscalYear: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  taxRate: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
};

// ---------------------------------------------------------------------------
// Sample fixtures
// ---------------------------------------------------------------------------
const sampleAccount = {
  id: "cuid-acc-1",
  tenantId: "acme-tenant-id",
  code: "1000",
  name: "Cash",
  type: "asset",
  subtype: "current",
  parentId: null,
  isActive: true,
  isSystem: false,
  description: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

const sampleFiscalYear = {
  id: "cuid-fy-1",
  tenantId: "acme-tenant-id",
  name: "FY 2026",
  startDate: new Date("2026-01-01"),
  endDate: new Date("2026-12-31"),
  isClosed: false,
  closedAt: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

const sampleJournalLine = {
  id: "cuid-jl-1",
  journalEntryId: "cuid-je-1",
  accountId: "cuid-acc-1",
  debit: "1000.00",
  credit: "0.00",
  description: null,
};

const sampleJournalEntry = {
  id: "cuid-je-1",
  tenantId: "acme-tenant-id",
  entryNumber: "JE-0001",
  fiscalYearId: "cuid-fy-1",
  date: new Date("2026-01-15"),
  description: "Initial cash deposit",
  referenceType: null,
  referenceId: null,
  status: "draft",
  createdById: "user-1",
  postedAt: null,
  lines: [sampleJournalLine],
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

const sampleTaxRate = {
  id: "cuid-tr-1",
  tenantId: "acme-tenant-id",
  name: "VAT 12%",
  code: "VAT12",
  rate: "12.00",
  type: "percentage",
  isDefault: false,
  isActive: true,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

// ---------------------------------------------------------------------------
// 1. account.list
// ---------------------------------------------------------------------------
describe("accounting.account.list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns paginated accounts for authenticated user", async () => {
    mockDb.account.findMany.mockResolvedValue([sampleAccount]);
    mockDb.account.count.mockResolvedValue(1);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.accounting.account.list({ page: 1, limit: 50 });

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(50);
    expect(mockDb.account.findMany).toHaveBeenCalledOnce();
  });

  it("filters by type when provided", async () => {
    mockDb.account.findMany.mockResolvedValue([sampleAccount]);
    mockDb.account.count.mockResolvedValue(1);

    const caller = createCaller(authenticatedCtx());
    await caller.accounting.account.list({ page: 1, limit: 50, type: "asset" });

    const findManyCall = mockDb.account.findMany.mock.calls[0] as [{ where: unknown }];
    expect(findManyCall[0].where).toMatchObject({ type: "asset" });
  });

  it("filters by isActive when provided", async () => {
    mockDb.account.findMany.mockResolvedValue([sampleAccount]);
    mockDb.account.count.mockResolvedValue(1);

    const caller = createCaller(authenticatedCtx());
    await caller.accounting.account.list({ page: 1, limit: 50, isActive: true });

    const findManyCall = mockDb.account.findMany.mock.calls[0] as [{ where: unknown }];
    expect(findManyCall[0].where).toMatchObject({ isActive: true });
  });

  it("rejects unauthenticated requests", async () => {
    const caller = createCaller(unauthenticatedCtx());
    await expect(caller.accounting.account.list({ page: 1, limit: 50 })).rejects.toThrow();
  });

  it("rejects parentId filter pointing to another tenant", async () => {
    const foreignParent = { ...sampleAccount, id: "cuid-foreign-parent", tenantId: "other-tenant" };
    mockDb.account.findUnique.mockResolvedValue(foreignParent);

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.accounting.account.list({ page: 1, limit: 50, parentId: "cuid-foreign-parent" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("allows parentId filter within same tenant", async () => {
    const sameParent = { ...sampleAccount, id: "cuid-parent-ok" };
    mockDb.account.findUnique.mockResolvedValue(sameParent);
    mockDb.account.findMany.mockResolvedValue([]);
    mockDb.account.count.mockResolvedValue(0);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.accounting.account.list({ page: 1, limit: 50, parentId: "cuid-parent-ok" });

    expect(result.items).toHaveLength(0);
    expect(mockDb.account.findUnique).toHaveBeenCalledWith({ where: { id: "cuid-parent-ok" } });
  });
});

// ---------------------------------------------------------------------------
// 2. account.byId
// ---------------------------------------------------------------------------
describe("accounting.account.byId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an account by id", async () => {
    mockDb.account.findUnique.mockResolvedValue(sampleAccount);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.accounting.account.byId({ id: "cuid-acc-1" });

    expect(result.id).toBe("cuid-acc-1");
    expect(result.name).toBe("Cash");
  });

  it("throws NOT_FOUND when account does not exist", async () => {
    mockDb.account.findUnique.mockResolvedValue(null);

    const caller = createCaller(authenticatedCtx());
    await expect(caller.accounting.account.byId({ id: "cuid-nonexistent" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

// ---------------------------------------------------------------------------
// 3. account.create
// ---------------------------------------------------------------------------
describe("accounting.account.create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates an account with required fields", async () => {
    const created = { ...sampleAccount, id: "cuid-new" };
    mockDb.account.create.mockResolvedValue(created);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.accounting.account.create({
      code: "1000",
      name: "Cash",
      type: "asset",
    });

    expect(result.id).toBe("cuid-new");
    expect(mockDb.account.create).toHaveBeenCalledOnce();
  });

  it("rejects demo tenant mutations", async () => {
    const demoCaller = createCaller({
      ...authenticatedCtx(),
      isDemoTenant: true,
    });
    await expect(
      demoCaller.accounting.account.create({
        code: "2000",
        name: "Accounts Payable",
        type: "liability",
      })
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 4. account.update
// ---------------------------------------------------------------------------
describe("accounting.account.update", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates account name and description", async () => {
    const existing = { ...sampleAccount };
    const updated = { ...existing, name: "Cash on Hand" };
    mockDb.account.findUnique.mockResolvedValue(existing);
    mockDb.account.update.mockResolvedValue(updated);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.accounting.account.update({
      id: "cuid-acc-1",
      name: "Cash on Hand",
    });

    expect(result.name).toBe("Cash on Hand");
    expect(mockDb.account.update).toHaveBeenCalledOnce();
  });

  it("throws NOT_FOUND when account does not exist", async () => {
    mockDb.account.findUnique.mockResolvedValue(null);

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.accounting.account.update({ id: "cuid-nonexistent", name: "New Name" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects re-parenting to an account in another tenant", async () => {
    const existing = { ...sampleAccount };
    const foreignParent = { ...sampleAccount, id: "cuid-foreign-parent", tenantId: "other-tenant" };
    mockDb.account.findUnique
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(foreignParent);

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.accounting.account.update({ id: "cuid-acc-1", parentId: "cuid-foreign-parent" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("allows re-parenting to an account in the same tenant", async () => {
    const existing = { ...sampleAccount };
    const sameParent = { ...sampleAccount, id: "cuid-parent-ok" };
    const updated = { ...existing, parentId: "cuid-parent-ok" };
    mockDb.account.findUnique
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(sameParent);
    mockDb.account.update.mockResolvedValue(updated);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.accounting.account.update({ id: "cuid-acc-1", parentId: "cuid-parent-ok" });

    expect(result.parentId).toBe("cuid-parent-ok");
    const updateCall = mockDb.account.update.mock.calls[0] as [{ data: Record<string, unknown> }];
    expect(updateCall[0].data).toMatchObject({ parentId: "cuid-parent-ok" });
  });

  it("allows clearing parentId by setting null", async () => {
    const existing = { ...sampleAccount, parentId: "cuid-parent-ok" };
    const updated = { ...existing, parentId: null };
    mockDb.account.findUnique.mockResolvedValue(existing);
    mockDb.account.update.mockResolvedValue(updated);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.accounting.account.update({ id: "cuid-acc-1", parentId: null });

    expect(result.parentId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 5. account.toggleActive
// ---------------------------------------------------------------------------
describe("accounting.account.toggleActive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("flips isActive from true to false", async () => {
    const existing = { ...sampleAccount, isActive: true };
    const updated = { ...existing, isActive: false };
    mockDb.account.findUnique.mockResolvedValue(existing);
    mockDb.account.update.mockResolvedValue(updated);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.accounting.account.toggleActive({ id: "cuid-acc-1" });

    expect(result.isActive).toBe(false);
    const updateCall = mockDb.account.update.mock.calls[0] as [
      { data: { isActive: boolean } },
    ];
    expect(updateCall[0].data.isActive).toBe(false);
  });

  it("flips isActive from false to true", async () => {
    const existing = { ...sampleAccount, isActive: false };
    const updated = { ...existing, isActive: true };
    mockDb.account.findUnique.mockResolvedValue(existing);
    mockDb.account.update.mockResolvedValue(updated);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.accounting.account.toggleActive({ id: "cuid-acc-1" });

    expect(result.isActive).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 6. journalEntry.list
// ---------------------------------------------------------------------------
describe("accounting.journalEntry.list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns paginated journal entries for authenticated user", async () => {
    mockDb.journalEntry.findMany.mockResolvedValue([sampleJournalEntry]);
    mockDb.journalEntry.count.mockResolvedValue(1);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.accounting.journalEntry.list({ page: 1, limit: 50 });

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(mockDb.journalEntry.findMany).toHaveBeenCalledOnce();
  });

  it("filters by status when provided", async () => {
    mockDb.journalEntry.findMany.mockResolvedValue([sampleJournalEntry]);
    mockDb.journalEntry.count.mockResolvedValue(1);

    const caller = createCaller(authenticatedCtx());
    await caller.accounting.journalEntry.list({ page: 1, limit: 50, status: "draft" });

    const findManyCall = mockDb.journalEntry.findMany.mock.calls[0] as [{ where: unknown }];
    expect(findManyCall[0].where).toMatchObject({ status: "draft" });
  });

  it("filters by fiscalYearId when provided", async () => {
    mockDb.journalEntry.findMany.mockResolvedValue([sampleJournalEntry]);
    mockDb.journalEntry.count.mockResolvedValue(1);

    const caller = createCaller(authenticatedCtx());
    await caller.accounting.journalEntry.list({ page: 1, limit: 50, fiscalYearId: "cuid-fy-1" });

    const findManyCall = mockDb.journalEntry.findMany.mock.calls[0] as [{ where: unknown }];
    expect(findManyCall[0].where).toMatchObject({ fiscalYearId: "cuid-fy-1" });
  });

  it("rejects unauthenticated requests", async () => {
    const caller = createCaller(unauthenticatedCtx());
    await expect(caller.accounting.journalEntry.list({ page: 1, limit: 50 })).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 7. journalEntry.byId
// ---------------------------------------------------------------------------
describe("accounting.journalEntry.byId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a journal entry by id", async () => {
    mockDb.journalEntry.findUnique.mockResolvedValue(sampleJournalEntry);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.accounting.journalEntry.byId({ id: "cuid-je-1" });

    expect(result.id).toBe("cuid-je-1");
    expect(result.entryNumber).toBe("JE-0001");
  });

  it("throws NOT_FOUND when journal entry does not exist", async () => {
    mockDb.journalEntry.findUnique.mockResolvedValue(null);

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.accounting.journalEntry.byId({ id: "cuid-nonexistent" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

// ---------------------------------------------------------------------------
// 8. journalEntry.create
// ---------------------------------------------------------------------------
describe("accounting.journalEntry.create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a journal entry with balanced lines", async () => {
    const created = { ...sampleJournalEntry, id: "cuid-new-je" };
    mockDb.fiscalYear.findUnique.mockResolvedValueOnce(sampleFiscalYear);
    mockDb.account.findMany.mockResolvedValueOnce([
      { id: "cuid-acc-1", tenantId: "acme-tenant-id" },
      { id: "cuid-acc-2", tenantId: "acme-tenant-id" },
    ]);
    mockDb.journalEntry.count.mockResolvedValueOnce(0);
    mockDb.journalEntry.create.mockResolvedValue(created);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.accounting.journalEntry.create({
      fiscalYearId: "cuid-fy-1",
      date: "2026-01-15",
      description: "Initial cash deposit",
      lines: [
        { accountId: "cuid-acc-1", debit: 1000, credit: 0 },
        { accountId: "cuid-acc-2", debit: 0, credit: 1000 },
      ],
    });

    expect(result.id).toBe("cuid-new-je");
    expect(mockDb.journalEntry.create).toHaveBeenCalledOnce();
  });

  it("rejects demo tenant mutations", async () => {
    const demoCaller = createCaller({
      ...authenticatedCtx(),
      isDemoTenant: true,
    });
    await expect(
      demoCaller.accounting.journalEntry.create({
        fiscalYearId: "cuid-fy-1",
        date: "2026-01-15",
        description: "Test entry",
        lines: [
          { accountId: "cuid-acc-1", debit: 500, credit: 0 },
          { accountId: "cuid-acc-2", debit: 0, credit: 500 },
        ],
      })
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 9. journalEntry.post
// ---------------------------------------------------------------------------
describe("accounting.journalEntry.post", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("posts a draft journal entry", async () => {
    const existingWithLines = {
      ...sampleJournalEntry,
      status: "draft",
      fiscalYearId: "cuid-fy-1",
      date: new Date("2025-06-15"),
      lines: [
        { id: "jl-1", accountId: "cuid-acc-1", debit: "1000.00", credit: "0.00" },
        { id: "jl-2", accountId: "cuid-acc-2", debit: "0.00",    credit: "1000.00" },
      ],
    };
    const posted = { ...existingWithLines, status: "posted", postedAt: new Date(), postedById: "user-1" };
    mockDb.journalEntry.findUnique.mockResolvedValue(existingWithLines);
    mockDb.account.findMany.mockResolvedValue([
      { id: "cuid-acc-1", tenantId: "acme-tenant-id", name: "Cash",    isActive: true },
      { id: "cuid-acc-2", tenantId: "acme-tenant-id", name: "Revenue", isActive: true },
    ]);
    mockDb.fiscalYear.findUnique.mockResolvedValue({
      id: "cuid-fy-1", tenantId: "acme-tenant-id", isClosed: false,
      startDate: new Date("2025-01-01"), endDate: new Date("2025-12-31"),
    });
    mockDb.journalEntry.update.mockResolvedValue(posted);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.accounting.journalEntry.post({ id: "cuid-je-1" });

    expect(result.status).toBe("posted");
    const updateCall = mockDb.journalEntry.update.mock.calls[0] as [
      { data: { status: string } },
    ];
    expect(updateCall[0].data.status).toBe("posted");
  });

  it("throws NOT_FOUND when journal entry does not exist", async () => {
    mockDb.journalEntry.findUnique.mockResolvedValue(null);

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.accounting.journalEntry.post({ id: "cuid-nonexistent" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("throws BAD_REQUEST when journal entry is already posted", async () => {
    const existing = { ...sampleJournalEntry, status: "posted" };
    mockDb.journalEntry.findUnique.mockResolvedValue(existing);

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.accounting.journalEntry.post({ id: "cuid-je-1" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

// ---------------------------------------------------------------------------
// 10. journalEntry.reverse
// ---------------------------------------------------------------------------
describe("accounting.journalEntry.reverse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reverses a posted entry by creating a counter-entry with swapped debits/credits", async () => {
    const postedEntry = {
      ...sampleJournalEntry,
      status: "posted",
      postedAt: new Date("2026-01-16"),
      lines: [
        { ...sampleJournalLine, accountId: "cuid-acc-1", debit: "1000.00", credit: "0.00" },
        { ...sampleJournalLine, id: "cuid-jl-2", accountId: "cuid-acc-2", debit: "0.00", credit: "1000.00" },
      ],
    };
    const reversalEntry = {
      ...sampleJournalEntry,
      id: "cuid-je-rev",
      entryNumber: "JE-0002",
      status: "posted",
      reversalOfId: "cuid-je-1",
      referenceType: "reversal",
      referenceId: "cuid-je-1",
      description: "Reversal of Initial cash deposit",
    };

    mockDb.journalEntry.findUnique.mockResolvedValue(postedEntry);
    mockDb.journalEntry.findFirst.mockResolvedValue(null); // not already reversed
    mockDb.journalEntry.count.mockResolvedValue(1);
    mockDb.journalEntry.create.mockResolvedValue(reversalEntry);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.accounting.journalEntry.reverse({ id: "cuid-je-1" });

    expect(result.id).toBe("cuid-je-rev");
    expect(result.referenceType).toBe("reversal");
    expect(result.referenceId).toBe("cuid-je-1");
    expect(result.reversalOfId).toBe("cuid-je-1");

    // Verify reversal was created with swapped debits/credits
    const createCall = mockDb.journalEntry.create.mock.calls[0] as [
      { data: { lines: { create: Array<{ debit: number; credit: number }> } } },
    ];
    const createdLines = createCall[0].data.lines.create;
    expect(createdLines[0]?.debit).toBe(0);
    expect(createdLines[0]?.credit).toBe(1000);
    expect(createdLines[1]?.debit).toBe(1000);
    expect(createdLines[1]?.credit).toBe(0);

    // Verify original was NOT voided (stays "posted" per DECISIONS_LOG §A)
    const updateCalls = mockDb.journalEntry.update.mock.calls as Array<[{ where: { id: string }; data: { status: string } }]>;
    const voidCall = updateCalls.find((call) => call[0]?.data?.status === "void");
    expect(voidCall).toBeUndefined();
  });

  it("throws NOT_FOUND when journal entry does not exist", async () => {
    mockDb.journalEntry.findUnique.mockResolvedValue(null);

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.accounting.journalEntry.reverse({ id: "cuid-nonexistent" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("throws BAD_REQUEST when journal entry is still draft", async () => {
    const draft = { ...sampleJournalEntry, status: "draft" };
    mockDb.journalEntry.findUnique.mockResolvedValue(draft);

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.accounting.journalEntry.reverse({ id: "cuid-je-1" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("throws BAD_REQUEST when journal entry is already void", async () => {
    const voided = { ...sampleJournalEntry, status: "void" };
    mockDb.journalEntry.findUnique.mockResolvedValue(voided);

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.accounting.journalEntry.reverse({ id: "cuid-je-1" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects demo tenant mutations", async () => {
    const demoCaller = createCaller({
      ...authenticatedCtx(),
      isDemoTenant: true,
    });
    await expect(
      demoCaller.accounting.journalEntry.reverse({ id: "cuid-je-1" })
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 11. fiscalYear.list
// ---------------------------------------------------------------------------
describe("accounting.fiscalYear.list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns paginated fiscal years for authenticated user", async () => {
    mockDb.fiscalYear.findMany.mockResolvedValue([sampleFiscalYear]);
    mockDb.fiscalYear.count.mockResolvedValue(1);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.accounting.fiscalYear.list({ page: 1, limit: 50 });

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(mockDb.fiscalYear.findMany).toHaveBeenCalledOnce();
  });

  it("rejects unauthenticated requests", async () => {
    const caller = createCaller(unauthenticatedCtx());
    await expect(caller.accounting.fiscalYear.list({ page: 1, limit: 50 })).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 12. fiscalYear.create
// ---------------------------------------------------------------------------
describe("accounting.fiscalYear.create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a fiscal year with required fields", async () => {
    const created = { ...sampleFiscalYear, id: "cuid-new-fy" };
    mockDb.fiscalYear.create.mockResolvedValue(created);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.accounting.fiscalYear.create({
      name: "FY 2026",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
    });

    expect(result.id).toBe("cuid-new-fy");
    expect(mockDb.fiscalYear.create).toHaveBeenCalledOnce();
  });

  it("rejects demo tenant mutations", async () => {
    const demoCaller = createCaller({
      ...authenticatedCtx(),
      isDemoTenant: true,
    });
    await expect(
      demoCaller.accounting.fiscalYear.create({
        name: "FY 2027",
        startDate: "2027-01-01",
        endDate: "2027-12-31",
      })
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 13. taxRate.list
// ---------------------------------------------------------------------------
describe("accounting.taxRate.list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns paginated tax rates for authenticated user", async () => {
    mockDb.taxRate.findMany.mockResolvedValue([sampleTaxRate]);
    mockDb.taxRate.count.mockResolvedValue(1);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.accounting.taxRate.list({ page: 1, limit: 50 });

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(mockDb.taxRate.findMany).toHaveBeenCalledOnce();
  });

  it("filters by isActive when provided", async () => {
    mockDb.taxRate.findMany.mockResolvedValue([sampleTaxRate]);
    mockDb.taxRate.count.mockResolvedValue(1);

    const caller = createCaller(authenticatedCtx());
    await caller.accounting.taxRate.list({ page: 1, limit: 50, isActive: true });

    const findManyCall = mockDb.taxRate.findMany.mock.calls[0] as [{ where: unknown }];
    expect(findManyCall[0].where).toMatchObject({ isActive: true });
  });

  it("rejects unauthenticated requests", async () => {
    const caller = createCaller(unauthenticatedCtx());
    await expect(caller.accounting.taxRate.list({ page: 1, limit: 50 })).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 14. taxRate.create
// ---------------------------------------------------------------------------
describe("accounting.taxRate.create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a tax rate with required fields", async () => {
    const created = { ...sampleTaxRate, id: "cuid-new-tr" };
    mockDb.taxRate.create.mockResolvedValue(created);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.accounting.taxRate.create({
      name: "VAT 12%",
      code: "VAT12",
      rate: 12,
      type: "percentage",
    });

    expect(result.id).toBe("cuid-new-tr");
    expect(mockDb.taxRate.create).toHaveBeenCalledOnce();
  });

  it("rejects demo tenant mutations", async () => {
    const demoCaller = createCaller({
      ...authenticatedCtx(),
      isDemoTenant: true,
    });
    await expect(
      demoCaller.accounting.taxRate.create({
        name: "GST 10%",
        code: "GST10",
        rate: 10,
        type: "percentage",
      })
    ).rejects.toThrow();
  });
});
