/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
/**
 * Journal Entry posting / reversal / trial-balance tests (DECISIONS_LOG §A)
 *
 * 1.  post — happy path: balanced entry in open FY → status becomes "posted"
 * 2.  post — fails when Σdebit ≠ Σcredit (unbalanced guard)
 * 3.  post — fails when fiscal year is closed
 * 4.  post — fails when an account is inactive
 * 5.  post — fails when entry status is already "posted"
 * 6.  reverse — happy path: creates mirror entry, reversalOfId set, original NOT voided
 * 7.  reverse — fails when entry is not posted
 * 8.  reverse — fails when already reversed
 * 9.  update — fails when status is "posted" (immutability guard)
 * 10. trialBalance — returns aggregated rows with correct totals
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type * as OrqafyDb from "@orqafy/db";
import type { NextRequest } from "next/server";

// ── DB mock (hoisted so vi.mock factory can reference) ───────────────────────
const {
  mockAccountFindUnique,
  mockAccountFindMany,
  mockFiscalYearFindUnique,
  mockJournalEntryFindUnique,
  mockJournalEntryFindFirst,
  mockJournalEntryCreate,
  mockJournalEntryUpdate,
  mockJournalEntryCount,
  mockJournalLineFindMany,
  mockJournalLineCount,
  mockAuditLogCreate: _mockAuditLogCreate,
  mockRoleFindFirst,
  mockRolePermissionFindUnique,
  mockTransaction,
} = vi.hoisted(() => {
  const mockAuditLogCreate = vi.fn();
  const mockJournalEntryUpdate = vi.fn();
  const mockJournalEntryCreate = vi.fn();
  const mockJournalLineDeleteMany = vi.fn();

  return {
    mockAccountFindUnique:      vi.fn(),
    mockAccountFindMany:        vi.fn(),
    mockFiscalYearFindUnique:   vi.fn(),
    mockJournalEntryFindUnique: vi.fn(),
    mockJournalEntryFindFirst:  vi.fn(),
    mockJournalEntryCreate,
    mockJournalEntryUpdate,
    mockJournalEntryCount:      vi.fn(),
    mockJournalLineFindMany:    vi.fn(),
    mockJournalLineCount:       vi.fn(),
    mockAuditLogCreate,
    // RBAC matrix resolver mocks (tenant-rbac-standard.md §4) — the router's
    // procedures now run through matrixMiddleware, which calls hasPermission ->
    // prisma.role.findFirst + prisma.rolePermission.findUnique. Tests grant a
    // Platform Owner bypass role so all pre-existing business-logic assertions
    // below are unaffected by the RBAC layer.
    mockRoleFindFirst:            vi.fn(),
    mockRolePermissionFindUnique: vi.fn(),
    mockTransaction: vi.fn().mockImplementation((fn: any) =>
      Promise.resolve(fn({
        journalEntry: {
          create:  mockJournalEntryCreate,
          update:  mockJournalEntryUpdate,
        },
        journalLine: { deleteMany: mockJournalLineDeleteMany },
        auditLog:    { create: mockAuditLogCreate },
      }))
    ),
  };
});

// Keep the real `hasPermission` resolver (matrixMiddleware imports it from
// this module) — only replace the prisma client calls it makes.
vi.mock("@orqafy/db", async () => {
  const actual = await vi.importActual<typeof OrqafyDb>("@orqafy/db");
  return {
    ...actual,
    prisma: {
      account: {
        findUnique: mockAccountFindUnique,
        findMany:   mockAccountFindMany,
      },
      fiscalYear: {
        findUnique: mockFiscalYearFindUnique,
      },
      journalEntry: {
        findUnique: mockJournalEntryFindUnique,
        findFirst:  mockJournalEntryFindFirst,
        create:     mockJournalEntryCreate,
        update:     mockJournalEntryUpdate,
        count:      mockJournalEntryCount,
      },
      journalLine: {
        findMany: mockJournalLineFindMany,
        count:    mockJournalLineCount,
      },
      role: { findFirst: mockRoleFindFirst },
      rolePermission: { findUnique: mockRolePermissionFindUnique },
      $transaction: mockTransaction,
    },
    writeAuditLog: async (tx: any, entry: any) => {
      await tx.auditLog.create({ data: entry });
    },
  };
});

vi.mock("@/server/lib/rate-limit", () => ({
  rateLimiters: { api: { check: vi.fn() }, public: { check: vi.fn() } },
}));

// ── Imports (after mocks) ────────────────────────────────────────────────────
import { accountingRouter } from "@/server/trpc/routers/accounting";
import { createTRPCRouter, createCallerFactory } from "@/server/trpc/trpc";

const testRouter = createTRPCRouter({ accounting: accountingRouter });
const createCaller = createCallerFactory(testRouter);

function makeReq(): NextRequest { return {} as NextRequest; }

function ctx(tenantId: string, roles: string[] = ["Administrator"]) {
  return {
    req: makeReq(),
    userId: "user-1",
    roles,
    roleId: "role-a",
    tenantSlug: "test-slug",
    tenantId,
    securityVersion: 1,
    isDemoTenant: false,
    session: null,
  };
}

// ── Fixtures ─────────────────────────────────────────────────────────────────
const TENANT = "tenant-A";

const ACCOUNT_CASH = { id: "acc-cash", tenantId: TENANT, code: "1000", name: "Cash", type: "asset", isActive: true };
const ACCOUNT_REV  = { id: "acc-rev",  tenantId: TENANT, code: "4000", name: "Revenue", type: "revenue", isActive: true };
const ACCOUNT_INACTIVE = { id: "acc-inactive", tenantId: TENANT, code: "5000", name: "Old Expense", type: "expense", isActive: false };

const OPEN_FY = {
  id: "fy-2025", tenantId: TENANT, name: "FY2025", isClosed: false,
  startDate: new Date("2025-01-01"), endDate: new Date("2025-12-31"),
};
const CLOSED_FY = { ...OPEN_FY, id: "fy-2024", isClosed: true };

const LINES_BALANCED = [
  { id: "line-1", accountId: "acc-cash", debit: 1000, credit: 0, description: null },
  { id: "line-2", accountId: "acc-rev",  debit: 0, credit: 1000, description: null },
];
const LINES_UNBALANCED = [
  { id: "line-1", accountId: "acc-cash", debit: 1000, credit: 0, description: null },
  { id: "line-2", accountId: "acc-rev",  debit: 0, credit: 500, description: null },
];

const DRAFT_ENTRY = {
  id: "je-001", tenantId: TENANT, entryNumber: "JE-0001", status: "draft",
  description: "Test entry", fiscalYearId: "fy-2025",
  date: new Date("2025-06-15"),
  referenceType: null, referenceId: null,
  lines: LINES_BALANCED,
};
const POSTED_ENTRY = { ...DRAFT_ENTRY, id: "je-002", entryNumber: "JE-0002", status: "posted", postedAt: new Date() };

// ── 1. post — happy path ──────────────────────────────────────────────────────
describe("journalEntry.post — happy path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRoleFindFirst.mockResolvedValue({ id: "role-x", tenantId: TENANT, name: "Platform Owner" });
  });

  it("transitions DRAFT → POSTED with all guards passing", async () => {
    mockJournalEntryFindUnique.mockResolvedValueOnce(DRAFT_ENTRY);
    mockAccountFindMany.mockResolvedValueOnce([ACCOUNT_CASH, ACCOUNT_REV]);
    mockFiscalYearFindUnique.mockResolvedValueOnce(OPEN_FY);
    const postedEntry = { ...DRAFT_ENTRY, status: "posted", postedAt: new Date(), postedById: "user-1" };
    mockJournalEntryUpdate.mockResolvedValueOnce(postedEntry);

    const caller = createCaller(ctx(TENANT));
    const result = await caller.accounting.journalEntry.post({ id: DRAFT_ENTRY.id });

    expect(result.status).toBe("posted");
    expect(mockJournalEntryUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "posted", postedById: "user-1" }),
      })
    );
  });
});

// ── 2. post — unbalanced guard ────────────────────────────────────────────────
describe("journalEntry.post — unbalanced guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRoleFindFirst.mockResolvedValue({ id: "role-x", tenantId: TENANT, name: "Platform Owner" });
  });

  it("throws BAD_REQUEST when Σdebit ≠ Σcredit", async () => {
    mockJournalEntryFindUnique.mockResolvedValueOnce({ ...DRAFT_ENTRY, lines: LINES_UNBALANCED });

    const caller = createCaller(ctx(TENANT));
    await expect(
      caller.accounting.journalEntry.post({ id: DRAFT_ENTRY.id })
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("Unbalanced") });
  });
});

// ── 3. post — closed fiscal year guard ───────────────────────────────────────
describe("journalEntry.post — closed fiscal year guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRoleFindFirst.mockResolvedValue({ id: "role-x", tenantId: TENANT, name: "Platform Owner" });
  });

  it("throws BAD_REQUEST when fiscal year is closed", async () => {
    mockJournalEntryFindUnique.mockResolvedValueOnce({ ...DRAFT_ENTRY, fiscalYearId: "fy-2024" });
    mockAccountFindMany.mockResolvedValueOnce([ACCOUNT_CASH, ACCOUNT_REV]);
    mockFiscalYearFindUnique.mockResolvedValueOnce(CLOSED_FY);

    const caller = createCaller(ctx(TENANT));
    await expect(
      caller.accounting.journalEntry.post({ id: DRAFT_ENTRY.id })
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("closed fiscal year") });
  });
});

// ── 4. post — inactive account guard ─────────────────────────────────────────
describe("journalEntry.post — inactive account guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRoleFindFirst.mockResolvedValue({ id: "role-x", tenantId: TENANT, name: "Platform Owner" });
  });

  it("throws BAD_REQUEST when a line account is inactive", async () => {
    const linesWithInactive = [
      { id: "line-1", accountId: "acc-inactive", debit: 1000, credit: 0, description: null },
      { id: "line-2", accountId: "acc-rev",       debit: 0, credit: 1000, description: null },
    ];
    mockJournalEntryFindUnique.mockResolvedValueOnce({ ...DRAFT_ENTRY, lines: linesWithInactive });
    mockAccountFindMany.mockResolvedValueOnce([ACCOUNT_INACTIVE, ACCOUNT_REV]);

    const caller = createCaller(ctx(TENANT));
    await expect(
      caller.accounting.journalEntry.post({ id: DRAFT_ENTRY.id })
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("inactive") });
  });
});

// ── 5. post — already posted guard ───────────────────────────────────────────
describe("journalEntry.post — already posted guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRoleFindFirst.mockResolvedValue({ id: "role-x", tenantId: TENANT, name: "Platform Owner" });
  });

  it("throws BAD_REQUEST when entry is already posted", async () => {
    mockJournalEntryFindUnique.mockResolvedValueOnce(POSTED_ENTRY);

    const caller = createCaller(ctx(TENANT));
    await expect(
      caller.accounting.journalEntry.post({ id: POSTED_ENTRY.id })
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("draft") });
  });
});

// ── 6. reverse — happy path ───────────────────────────────────────────────────
describe("journalEntry.reverse — happy path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRoleFindFirst.mockResolvedValue({ id: "role-x", tenantId: TENANT, name: "Platform Owner" });
  });

  it("creates a mirror reversal entry; original status stays 'posted'", async () => {
    mockJournalEntryFindUnique.mockResolvedValueOnce(POSTED_ENTRY);
    mockJournalEntryFindFirst.mockResolvedValueOnce(null); // not already reversed
    mockJournalEntryCount.mockResolvedValueOnce(5);

    const reversalEntry = {
      id: "je-rev-001", tenantId: TENANT, entryNumber: "JE-0006",
      status: "posted", reversalOfId: POSTED_ENTRY.id, postedAt: new Date(),
      description: `Reversal of ${POSTED_ENTRY.description}`,
      lines: LINES_BALANCED.map((l) => ({ ...l, debit: l.credit, credit: l.debit })),
    };
    mockJournalEntryCreate.mockResolvedValueOnce(reversalEntry);

    const caller = createCaller(ctx(TENANT));
    const result = await caller.accounting.journalEntry.reverse({ id: POSTED_ENTRY.id });

    // Reversal entry created with swapped lines
    expect(result.reversalOfId).toBe(POSTED_ENTRY.id);
    expect(result.status).toBe("posted");

    // Original must NOT have been updated to "void"
    const updateCalls = mockJournalEntryUpdate.mock.calls;
    const voidCall = updateCalls.find((call: any[]) =>
      JSON.stringify(call).includes("void")
    );
    expect(voidCall).toBeUndefined();
  });
});

// ── 7. reverse — not posted guard ─────────────────────────────────────────────
describe("journalEntry.reverse — not posted guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRoleFindFirst.mockResolvedValue({ id: "role-x", tenantId: TENANT, name: "Platform Owner" });
  });

  it("throws BAD_REQUEST when entry is not posted", async () => {
    mockJournalEntryFindUnique.mockResolvedValueOnce(DRAFT_ENTRY);

    const caller = createCaller(ctx(TENANT));
    await expect(
      caller.accounting.journalEntry.reverse({ id: DRAFT_ENTRY.id })
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("posted") });
  });
});

// ── 8. reverse — already reversed guard ──────────────────────────────────────
describe("journalEntry.reverse — already reversed guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRoleFindFirst.mockResolvedValue({ id: "role-x", tenantId: TENANT, name: "Platform Owner" });
  });

  it("throws BAD_REQUEST when entry has already been reversed", async () => {
    mockJournalEntryFindUnique.mockResolvedValueOnce(POSTED_ENTRY);
    mockJournalEntryFindFirst.mockResolvedValueOnce({ id: "je-existing-reversal" }); // already reversed

    const caller = createCaller(ctx(TENANT));
    await expect(
      caller.accounting.journalEntry.reverse({ id: POSTED_ENTRY.id })
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("already been reversed") });
  });
});

// ── 9. update — immutability guard (posted entry) ─────────────────────────────
describe("journalEntry.update — posted entry immutability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRoleFindFirst.mockResolvedValue({ id: "role-x", tenantId: TENANT, name: "Platform Owner" });
  });

  it("throws BAD_REQUEST when trying to update a posted entry", async () => {
    mockJournalEntryFindUnique.mockResolvedValueOnce(POSTED_ENTRY);

    const caller = createCaller(ctx(TENANT));
    await expect(
      caller.accounting.journalEntry.update({ id: POSTED_ENTRY.id, description: "New description" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("draft") });
  });
});

// ── 10. trialBalance — aggregation ───────────────────────────────────────────
describe("journalEntry.trialBalance — aggregation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRoleFindFirst.mockResolvedValue({ id: "role-x", tenantId: TENANT, name: "Platform Owner" });
  });

  it("returns aggregated rows with correct totals", async () => {
    mockJournalLineFindMany.mockResolvedValueOnce([
      { id: "jl-1", accountId: "acc-cash", debit: 1000, credit: 0, account: ACCOUNT_CASH },
      { id: "jl-2", accountId: "acc-rev",  debit: 0, credit: 1000, account: ACCOUNT_REV },
      // second line for same account — should aggregate
      { id: "jl-3", accountId: "acc-cash", debit: 500, credit: 0, account: ACCOUNT_CASH },
    ]);

    const caller = createCaller(ctx(TENANT));
    const result = await caller.accounting.journalEntry.trialBalance({});

    expect(result.rows).toHaveLength(2);

    const cashRow = result.rows.find((r) => r.account.id === "acc-cash");
    expect(cashRow?.debit).toBe(1500);
    expect(cashRow?.credit).toBe(0);

    const revRow = result.rows.find((r) => r.account.id === "acc-rev");
    expect(revRow?.debit).toBe(0);
    expect(revRow?.credit).toBe(1000);

    expect(result.totalDebit).toBe(1500);
    expect(result.totalCredit).toBe(1000);
    expect(result.isBalanced).toBe(false); // 1500 ≠ 1000
  });

  it("reports isBalanced=true when totals match", async () => {
    mockJournalLineFindMany.mockResolvedValueOnce([
      { id: "jl-1", accountId: "acc-cash", debit: 1000, credit: 0, account: ACCOUNT_CASH },
      { id: "jl-2", accountId: "acc-rev",  debit: 0, credit: 1000, account: ACCOUNT_REV },
    ]);

    const caller = createCaller(ctx(TENANT));
    const result = await caller.accounting.journalEntry.trialBalance({});

    expect(result.totalDebit).toBe(1000);
    expect(result.totalCredit).toBe(1000);
    expect(result.isBalanced).toBe(true);
  });
});
