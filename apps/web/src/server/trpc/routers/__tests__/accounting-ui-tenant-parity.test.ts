/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
/**
 * Accounting UI surface — tenant parity tests
 *
 * Covers the mutations wired by the Phase-8 accounting UI scaffolding:
 *   account.create     — tenantId injected from ctx, not input
 *   account.update     — loadAccountForTenant cross-tenant guard
 *   account.toggleActive — loadAccountForTenant cross-tenant guard
 *   journalEntry.create — tenantId injected from ctx; FY + account cross-tenant guards
 *   journalEntry.update — loadJournalEntryForTenant cross-tenant guard; draft-only guard
 *
 * Pattern mirrors purchasing-ui-tenant-parity.test.ts.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type * as OrqafyDb from "@orqafy/db";
import type { NextRequest } from "next/server";

// ── DB mock ───────────────────────────────────────────────────────────────────
const {
  mockAccountFindUnique,
  mockAccountCreate,
  mockAccountUpdate,
  mockAccountCount,
  mockFiscalYearFindUnique,
  mockJournalEntryFindUnique,
  mockJournalEntryCreate,
  mockJournalEntryUpdate,
  mockJournalEntryCount,
  mockAccountFindMany,
  mockJournalLineFindMany,
  mockRoleFindFirst,
  mockRolePermissionFindUnique,
  mockTransaction,
} = vi.hoisted(() => ({
  mockAccountFindUnique:     vi.fn(),
  mockAccountCreate:         vi.fn(),
  mockAccountUpdate:         vi.fn(),
  mockAccountCount:          vi.fn(),
  mockFiscalYearFindUnique:  vi.fn(),
  mockJournalEntryFindUnique: vi.fn(),
  mockJournalEntryCreate:    vi.fn(),
  mockJournalEntryUpdate:    vi.fn(),
  mockJournalEntryCount:     vi.fn(),
  mockAccountFindMany:       vi.fn(),
  mockJournalLineFindMany:   vi.fn(),
  // RBAC matrix resolver mocks (tenant-rbac-standard.md §4) — the router's
  // procedures now run through matrixMiddleware, which calls hasPermission ->
  // prisma.role.findFirst + prisma.rolePermission.findUnique. Tests grant a
  // Platform Owner bypass role so all pre-existing tenant-parity assertions
  // below are unaffected by the RBAC layer.
  mockRoleFindFirst:            vi.fn(),
  mockRolePermissionFindUnique: vi.fn(),
  mockTransaction: vi.fn().mockImplementation((fn: any) => Promise.resolve(fn({
    account: { create: mockAccountCreate, update: mockAccountUpdate },
    journalEntry: { create: mockJournalEntryCreate, update: mockJournalEntryUpdate },
    journalLine: { deleteMany: vi.fn() },
  }))),
}));

// Keep the real `hasPermission` resolver (matrixMiddleware imports it from
// this module) — only replace the prisma client calls it makes.
vi.mock("@orqafy/db", async () => {
  const actual = await vi.importActual<typeof OrqafyDb>("@orqafy/db");
  return {
    ...actual,
    prisma: {
      account: {
        findUnique:  mockAccountFindUnique,
        create:      mockAccountCreate,
        update:      mockAccountUpdate,
        count:       mockAccountCount,
        findMany:    mockAccountFindMany,
      },
      fiscalYear: {
        findUnique: mockFiscalYearFindUnique,
      },
      journalEntry: {
        findUnique: mockJournalEntryFindUnique,
        create:     mockJournalEntryCreate,
        update:     mockJournalEntryUpdate,
        count:      mockJournalEntryCount,
      },
      journalLine: {
        findMany: mockJournalLineFindMany,
      },
      role: { findFirst: mockRoleFindFirst },
      rolePermission: { findUnique: mockRolePermissionFindUnique },
      $transaction: mockTransaction,
    },
    writeAuditLog: vi.fn(),
  };
});

vi.mock("@/server/lib/rate-limit", () => ({
  rateLimiters: { api: { check: vi.fn() }, public: { check: vi.fn() } },
}));

import { accountingRouter } from "@/server/trpc/routers/accounting";
import { createTRPCRouter, createCallerFactory } from "@/server/trpc/trpc";

const testRouter = createTRPCRouter({ accounting: accountingRouter });
const createCaller = createCallerFactory(testRouter);

function makeReq(): NextRequest { return {} as NextRequest; }

function ctx(tenantId: string) {
  return {
    req: makeReq(),
    userId: "user-1",
    roles: ["Administrator"] as string[],
    roleId: "role-a",
    tenantSlug: "test-slug",
    tenantId,
    securityVersion: 1,
    isDemoTenant: false,
    session: null,
  };
}

const fakeAccountA = { id: "acc-A", tenantId: "tenant-A", code: "1000", name: "Cash", type: "asset", isActive: true, isSystem: false };
const fakeAccountB = { id: "acc-B", tenantId: "tenant-B", code: "1001", name: "AR", type: "asset", isActive: true, isSystem: false };
const fakeFyA = { id: "fy-A", tenantId: "tenant-A", name: "FY2025", isClosed: false };
const fakeJeA = { id: "je-A", tenantId: "tenant-A", entryNumber: "JE-0001", status: "draft", description: "Test", lines: [] };
const fakeJeB = { id: "je-B", tenantId: "tenant-B", entryNumber: "JE-0002", status: "draft", description: "Other", lines: [] };

// ── account.update — tenant guard ─────────────────────────────────────────────
describe("account.update — tenant guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRoleFindFirst.mockResolvedValue({ id: "role-x", tenantId: "tenant-A", name: "Platform Owner" });
  });

  it("allows update when account belongs to caller's tenant", async () => {
    mockAccountFindUnique.mockResolvedValue(fakeAccountA);
    mockAccountUpdate.mockResolvedValue({ ...fakeAccountA, name: "Updated Cash" });
    const caller = createCaller(ctx("tenant-A"));
    const result = await caller.accounting.account.update({ id: "acc-A", name: "Updated Cash" });
    expect(result.name).toBe("Updated Cash");
  });

  it("throws NOT_FOUND when account belongs to different tenant", async () => {
    mockAccountFindUnique.mockResolvedValue(fakeAccountB); // tenant-B account
    const caller = createCaller(ctx("tenant-A"));
    await expect(
      caller.accounting.account.update({ id: "acc-B", name: "Hijack" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

// ── account.toggleActive — tenant guard ───────────────────────────────────────
describe("account.toggleActive — tenant guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRoleFindFirst.mockResolvedValue({ id: "role-x", tenantId: "tenant-A", name: "Platform Owner" });
  });

  it("allows toggle when account belongs to caller's tenant", async () => {
    mockAccountFindUnique.mockResolvedValue(fakeAccountA);
    mockAccountUpdate.mockResolvedValue({ ...fakeAccountA, isActive: false });
    const caller = createCaller(ctx("tenant-A"));
    const result = await caller.accounting.account.toggleActive({ id: "acc-A" });
    expect(result.isActive).toBe(false);
  });

  it("throws NOT_FOUND when account belongs to different tenant", async () => {
    mockAccountFindUnique.mockResolvedValue(fakeAccountB);
    const caller = createCaller(ctx("tenant-A"));
    await expect(
      caller.accounting.account.toggleActive({ id: "acc-B" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

// ── account.create — tenantId from ctx ───────────────────────────────────────
describe("account.create — tenantId injected from ctx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRoleFindFirst.mockResolvedValue({ id: "role-x", tenantId: "tenant-A", name: "Platform Owner" });
  });

  it("sets tenantId from ctx, not user input", async () => {
    mockAccountCreate.mockResolvedValue({ ...fakeAccountA, id: "acc-new" });
    const caller = createCaller(ctx("tenant-A"));
    await caller.accounting.account.create({
      code: "1000",
      name: "Cash",
      type: "asset",
      isSystem: false,
    });
    expect(mockAccountCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tenantId: "tenant-A" }) })
    );
  });
});

// ── journalEntry.create — FY cross-tenant guard ───────────────────────────────
describe("journalEntry.create — FY cross-tenant guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRoleFindFirst.mockResolvedValue({ id: "role-x", tenantId: "tenant-A", name: "Platform Owner" });
  });

  it("throws NOT_FOUND when fiscal year belongs to different tenant", async () => {
    const fakeFyB = { id: "fy-B", tenantId: "tenant-B", name: "FY2025-B", isClosed: false };
    mockFiscalYearFindUnique.mockResolvedValue(fakeFyB);
    const caller = createCaller(ctx("tenant-A"));
    await expect(
      caller.accounting.journalEntry.create({
        fiscalYearId: "fy-B",
        date: "2025-01-01",
        description: "Test",
        lines: [
          { accountId: "acc-A", debit: 100, credit: 0 },
          { accountId: "acc-B", debit: 0, credit: 100 },
        ],
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("sets tenantId from ctx on journal entry", async () => {
    mockFiscalYearFindUnique.mockResolvedValue(fakeFyA);
    mockAccountFindMany.mockResolvedValue([fakeAccountA, { ...fakeAccountA, id: "acc-A2" }]);
    mockJournalEntryCount.mockResolvedValue(0);
    mockJournalEntryCreate.mockResolvedValue({ ...fakeJeA, lines: [] });
    const caller = createCaller(ctx("tenant-A"));
    await caller.accounting.journalEntry.create({
      fiscalYearId: "fy-A",
      date: "2025-01-01",
      description: "Rent payment",
      lines: [
        { accountId: "acc-A", debit: 5000, credit: 0 },
        { accountId: "acc-A2", debit: 0, credit: 5000 },
      ],
    });
    expect(mockJournalEntryCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tenantId: "tenant-A" }) })
    );
  });
});

// ── journalEntry.update — tenant guard + draft-only guard ─────────────────────
describe("journalEntry.update — tenant guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRoleFindFirst.mockResolvedValue({ id: "role-x", tenantId: "tenant-A", name: "Platform Owner" });
  });

  it("allows update when entry belongs to caller's tenant and is draft", async () => {
    mockJournalEntryFindUnique.mockResolvedValue(fakeJeA);
    mockJournalEntryUpdate.mockResolvedValue({ ...fakeJeA, description: "Updated" });
    const caller = createCaller(ctx("tenant-A"));
    const result = await caller.accounting.journalEntry.update({ id: "je-A", description: "Updated" });
    expect(result.description).toBe("Updated");
  });

  it("throws NOT_FOUND when entry belongs to different tenant", async () => {
    mockJournalEntryFindUnique.mockResolvedValue(fakeJeB); // tenant-B entry
    const caller = createCaller(ctx("tenant-A"));
    await expect(
      caller.accounting.journalEntry.update({ id: "je-B", description: "Hijack" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("throws BAD_REQUEST when entry is not draft", async () => {
    mockJournalEntryFindUnique.mockResolvedValue({ ...fakeJeA, status: "posted" });
    const caller = createCaller(ctx("tenant-A"));
    await expect(
      caller.accounting.journalEntry.update({ id: "je-A", description: "Try edit posted" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
