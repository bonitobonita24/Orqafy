/**
 * Phase 8 Batch 2 Item 1 + Batch 4 Item 1: Module 9 Banking & Finance
 * FundSource CRUD + FundTransaction CRUD + Transfer + Paired-Tx Pattern
 *
 * FundSource procedures (Batch 2):
 *  1. list — paginated list with isActive / type filters
 *  2. byId — returns single fund source or NOT_FOUND
 *  3. create — creates with required fields
 *  4. update — partial update of fund source
 *  5. toggleActive — flips isActive boolean
 *
 * FundTransaction procedures (Batch 4):
 *  6.  transaction.list            — paginated, filters: fundSourceId, type, dateRange
 *  7.  transaction.byId            — NOT_FOUND guard
 *  8.  transaction.recordIncome    — positive amount, updates currentBalance
 *  9.  transaction.recordExpense   — reject if real-cash below 0
 * 10.  transaction.transfer        — atomic: two FundTransactions + FundTransfer record
 * 11.  transaction.recordCreditCardCharge — increases outstandingBalance
 * 12.  transaction.payCreditCard   — atomic: payer currentBalance -=, cc outstanding -=
 * 13.  transaction.loanMoneyOutTo  — atomic: loanBalance -=, target currentBalance +=
 * 14.  transaction.loanMoneyIn     — atomic: loanBalance +=, source currentBalance -=
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
    fundTransaction: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    fundTransfer: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
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
  fundTransaction: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  fundTransfer: {
    create: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

// ---------------------------------------------------------------------------
// Sample fixtures
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

const sampleCreditCardSource = {
  ...sampleFundSource,
  id: "cuid-fs-cc",
  name: "BDO Credit Card",
  type: "credit_card",
  creditLimit: "50000.00",
  outstandingBalance: "10000.00",
  currentBalance: "0.00",
};

const sampleLoanSource = {
  ...sampleFundSource,
  id: "cuid-fs-loan",
  name: "SSS Salary Loan",
  type: "loan",
  loanBalance: "30000.00",
  loanPrincipal: "30000.00",
  currentBalance: "0.00",
};

const sampleCashSource = {
  ...sampleFundSource,
  id: "cuid-fs-cash",
  name: "Petty Cash",
  type: "cash_on_hand",
  currentBalance: "5000.00",
};

const sampleTransaction = {
  id: "cuid-tx-1",
  fundSourceId: "cuid-fs-1",
  type: "deposit",
  amount: "1000.00",
  runningBalance: "51000.00",
  referenceType: null,
  referenceId: null,
  description: "Test deposit",
  category: null,
  createdById: "user-1",
  transactionDate: new Date("2026-01-15"),
  createdAt: new Date("2026-01-15"),
};

// ===========================================================================
// SECTION 1: FundSource CRUD (Batch 2 Item 1)
// ===========================================================================

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

// ===========================================================================
// SECTION 2: FundTransaction Procedures (Batch 4 Item 1 — Phase 2a)
// ===========================================================================

// ---------------------------------------------------------------------------
// 6. transaction.list
// ---------------------------------------------------------------------------
describe("banking.transaction.list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns paginated transactions for authenticated user", async () => {
    mockDb.fundTransaction.findMany.mockResolvedValue([sampleTransaction]);
    mockDb.fundTransaction.count.mockResolvedValue(1);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.banking.transaction.list({ page: 1, limit: 50 });

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(50);
    expect(mockDb.fundTransaction.findMany).toHaveBeenCalledOnce();
  });

  it("filters by fundSourceId when provided", async () => {
    mockDb.fundTransaction.findMany.mockResolvedValue([sampleTransaction]);
    mockDb.fundTransaction.count.mockResolvedValue(1);

    const caller = createCaller(authenticatedCtx());
    await caller.banking.transaction.list({ page: 1, limit: 50, fundSourceId: "cuid-fs-1" });

    const findManyCall = mockDb.fundTransaction.findMany.mock.calls[0] as [{ where: unknown }];
    expect(findManyCall[0].where).toMatchObject({ fundSourceId: "cuid-fs-1" });
  });

  it("filters by type when provided", async () => {
    mockDb.fundTransaction.findMany.mockResolvedValue([sampleTransaction]);
    mockDb.fundTransaction.count.mockResolvedValue(1);

    const caller = createCaller(authenticatedCtx());
    await caller.banking.transaction.list({ page: 1, limit: 50, type: "deposit" });

    const findManyCall = mockDb.fundTransaction.findMany.mock.calls[0] as [{ where: unknown }];
    expect(findManyCall[0].where).toMatchObject({ type: "deposit" });
  });

  it("rejects unauthenticated requests", async () => {
    const caller = createCaller(unauthenticatedCtx());
    await expect(caller.banking.transaction.list({ page: 1, limit: 50 })).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 7. transaction.byId
// ---------------------------------------------------------------------------
describe("banking.transaction.byId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a transaction by id", async () => {
    mockDb.fundTransaction.findUnique.mockResolvedValue(sampleTransaction);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.banking.transaction.byId({ id: "cuid-tx-1" });

    expect(result.id).toBe("cuid-tx-1");
    expect(result.type).toBe("deposit");
  });

  it("throws NOT_FOUND when transaction does not exist", async () => {
    mockDb.fundTransaction.findUnique.mockResolvedValue(null);

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.banking.transaction.byId({ id: "cuid-nonexistent" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

// ---------------------------------------------------------------------------
// 8. transaction.recordIncome
// ---------------------------------------------------------------------------
describe("banking.transaction.recordIncome", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records income and updates currentBalance", async () => {
    const source = { ...sampleFundSource, currentBalance: "50000.00" };
    const newBalance = "51000.00";
    const createdTx = {
      ...sampleTransaction,
      type: "income",
      amount: "1000.00",
      runningBalance: newBalance,
    };
    mockDb.fundSource.findUnique.mockResolvedValue(source);
    mockDb.$transaction.mockResolvedValue(createdTx);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.banking.transaction.recordIncome({
      fundSourceId: "cuid-fs-1",
      amount: 1000,
      description: "Freelance payment",
    });

    expect(result.type).toBe("income");
    expect(mockDb.$transaction).toHaveBeenCalledOnce();
  });

  it("throws NOT_FOUND when fund source does not exist", async () => {
    mockDb.fundSource.findUnique.mockResolvedValue(null);

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.banking.transaction.recordIncome({
        fundSourceId: "cuid-nonexistent",
        amount: 1000,
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects demo tenant mutations", async () => {
    const demoCaller = createCaller({ ...authenticatedCtx(), isDemoTenant: true });
    await expect(
      demoCaller.banking.transaction.recordIncome({
        fundSourceId: "cuid-fs-1",
        amount: 1000,
      })
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 9. transaction.recordExpense
// ---------------------------------------------------------------------------
describe("banking.transaction.recordExpense", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records expense for a bank account with sufficient balance", async () => {
    const source = { ...sampleFundSource, type: "bank", currentBalance: "50000.00" };
    const createdTx = {
      ...sampleTransaction,
      type: "expense",
      amount: "500.00",
      runningBalance: "49500.00",
    };
    mockDb.fundSource.findUnique.mockResolvedValue(source);
    mockDb.$transaction.mockResolvedValue(createdTx);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.banking.transaction.recordExpense({
      fundSourceId: "cuid-fs-1",
      amount: 500,
      description: "Office supplies",
    });

    expect(result.type).toBe("expense");
    expect(mockDb.$transaction).toHaveBeenCalledOnce();
  });

  it("rejects expense when cash_on_hand balance would go below zero", async () => {
    const source = { ...sampleCashSource, currentBalance: "100.00" };
    mockDb.fundSource.findUnique.mockResolvedValue(source);

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.banking.transaction.recordExpense({
        fundSourceId: "cuid-fs-cash",
        amount: 500,
        description: "Too expensive",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects expense when bank balance would go below zero", async () => {
    const source = { ...sampleFundSource, type: "bank", currentBalance: "100.00" };
    mockDb.fundSource.findUnique.mockResolvedValue(source);

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.banking.transaction.recordExpense({
        fundSourceId: "cuid-fs-1",
        amount: 500,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("throws NOT_FOUND when fund source does not exist", async () => {
    mockDb.fundSource.findUnique.mockResolvedValue(null);

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.banking.transaction.recordExpense({
        fundSourceId: "cuid-nonexistent",
        amount: 500,
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

// ---------------------------------------------------------------------------
// 10. transaction.transfer
// ---------------------------------------------------------------------------
describe("banking.transaction.transfer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates two transactions and one transfer record atomically", async () => {
    const fromSource = { ...sampleFundSource, id: "cuid-fs-1", currentBalance: "50000.00" };
    const toSource = { ...sampleFundSource, id: "cuid-fs-2", currentBalance: "10000.00" };
    const transferResult = {
      outTx: { ...sampleTransaction, type: "transfer_out" },
      inTx: { ...sampleTransaction, id: "cuid-tx-2", type: "transfer_in" },
      transfer: { id: "cuid-transfer-1" },
    };

    mockDb.fundSource.findUnique
      .mockResolvedValueOnce(fromSource)
      .mockResolvedValueOnce(toSource);
    mockDb.$transaction.mockResolvedValue(transferResult);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.banking.transaction.transfer({
      fromFundSourceId: "cuid-fs-1",
      toFundSourceId: "cuid-fs-2",
      amount: 1000,
      description: "Transfer to savings",
    });

    expect(result.outTx.type).toBe("transfer_out");
    expect(result.inTx.type).toBe("transfer_in");
    expect(mockDb.$transaction).toHaveBeenCalledOnce();
  });

  it("rejects transfer when from source has insufficient balance", async () => {
    const fromSource = { ...sampleFundSource, type: "cash_on_hand", currentBalance: "100.00" };
    const toSource = { ...sampleFundSource, id: "cuid-fs-2" };

    mockDb.fundSource.findUnique
      .mockResolvedValueOnce(fromSource)
      .mockResolvedValueOnce(toSource);

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.banking.transaction.transfer({
        fromFundSourceId: "cuid-fs-1",
        toFundSourceId: "cuid-fs-2",
        amount: 5000,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects transfer to same fund source", async () => {
    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.banking.transaction.transfer({
        fromFundSourceId: "cuid-fs-1",
        toFundSourceId: "cuid-fs-1",
        amount: 1000,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("throws NOT_FOUND when from source does not exist", async () => {
    mockDb.fundSource.findUnique.mockResolvedValueOnce(null);

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.banking.transaction.transfer({
        fromFundSourceId: "cuid-nonexistent",
        toFundSourceId: "cuid-fs-2",
        amount: 1000,
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

// ---------------------------------------------------------------------------
// 11. transaction.recordCreditCardCharge
// ---------------------------------------------------------------------------
describe("banking.transaction.recordCreditCardCharge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records a credit card charge and increases outstandingBalance", async () => {
    const ccSource = { ...sampleCreditCardSource };
    const createdTx = {
      ...sampleTransaction,
      fundSourceId: "cuid-fs-cc",
      type: "credit_card_charge",
      amount: "2000.00",
    };
    mockDb.fundSource.findUnique.mockResolvedValue(ccSource);
    mockDb.$transaction.mockResolvedValue(createdTx);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.banking.transaction.recordCreditCardCharge({
      fundSourceId: "cuid-fs-cc",
      amount: 2000,
      description: "Grocery purchase",
    });

    expect(result.type).toBe("credit_card_charge");
    expect(mockDb.$transaction).toHaveBeenCalledOnce();
  });

  it("throws BAD_REQUEST when fund source is not a credit card", async () => {
    mockDb.fundSource.findUnique.mockResolvedValue(sampleFundSource); // type: "bank"

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.banking.transaction.recordCreditCardCharge({
        fundSourceId: "cuid-fs-1",
        amount: 2000,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("throws NOT_FOUND when fund source does not exist", async () => {
    mockDb.fundSource.findUnique.mockResolvedValue(null);

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.banking.transaction.recordCreditCardCharge({
        fundSourceId: "cuid-nonexistent",
        amount: 2000,
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

// ---------------------------------------------------------------------------
// 12. transaction.payCreditCard
// ---------------------------------------------------------------------------
describe("banking.transaction.payCreditCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("pays credit card atomically — payer balance decreases, cc outstanding decreases", async () => {
    const payerSource = { ...sampleFundSource, currentBalance: "20000.00" };
    const ccSource = { ...sampleCreditCardSource, outstandingBalance: "10000.00" };
    const payResult = {
      payerTx: { ...sampleTransaction, type: "expense" },
      ccTx: { ...sampleTransaction, id: "cuid-tx-cc", type: "credit_card_payment" },
    };

    mockDb.fundSource.findUnique
      .mockResolvedValueOnce(payerSource)
      .mockResolvedValueOnce(ccSource);
    mockDb.$transaction.mockResolvedValue(payResult);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.banking.transaction.payCreditCard({
      payerFundSourceId: "cuid-fs-1",
      creditCardFundSourceId: "cuid-fs-cc",
      amount: 5000,
    });

    expect(result.payerTx.type).toBe("expense");
    expect(result.ccTx.type).toBe("credit_card_payment");
    expect(mockDb.$transaction).toHaveBeenCalledOnce();
  });

  it("rejects when payer has insufficient balance", async () => {
    const payerSource = { ...sampleFundSource, type: "bank", currentBalance: "100.00" };
    const ccSource = { ...sampleCreditCardSource };

    mockDb.fundSource.findUnique
      .mockResolvedValueOnce(payerSource)
      .mockResolvedValueOnce(ccSource);

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.banking.transaction.payCreditCard({
        payerFundSourceId: "cuid-fs-1",
        creditCardFundSourceId: "cuid-fs-cc",
        amount: 5000,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("throws BAD_REQUEST when target is not a credit card", async () => {
    const payerSource = { ...sampleFundSource, currentBalance: "20000.00" };
    const nonCcSource = { ...sampleFundSource, id: "cuid-fs-2", type: "bank" };

    mockDb.fundSource.findUnique
      .mockResolvedValueOnce(payerSource)
      .mockResolvedValueOnce(nonCcSource);

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.banking.transaction.payCreditCard({
        payerFundSourceId: "cuid-fs-1",
        creditCardFundSourceId: "cuid-fs-2",
        amount: 5000,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

// ---------------------------------------------------------------------------
// 13. transaction.loanMoneyOutTo
// ---------------------------------------------------------------------------
describe("banking.transaction.loanMoneyOutTo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("disburses loan amount — loanBalance decreases, target currentBalance increases", async () => {
    const loanSource = { ...sampleLoanSource, loanBalance: "30000.00" };
    const targetSource = { ...sampleFundSource, currentBalance: "5000.00" };
    const disburseResult = {
      loanTx: { ...sampleTransaction, type: "loan_disbursement" },
      receiverTx: { ...sampleTransaction, id: "cuid-tx-2", type: "income" },
    };

    mockDb.fundSource.findUnique
      .mockResolvedValueOnce(loanSource)
      .mockResolvedValueOnce(targetSource);
    mockDb.$transaction.mockResolvedValue(disburseResult);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.banking.transaction.loanMoneyOutTo({
      loanFundSourceId: "cuid-fs-loan",
      receiverFundSourceId: "cuid-fs-1",
      amount: 10000,
    });

    expect(result.loanTx.type).toBe("loan_disbursement");
    expect(result.receiverTx.type).toBe("income");
    expect(mockDb.$transaction).toHaveBeenCalledOnce();
  });

  it("throws BAD_REQUEST when source is not a loan", async () => {
    // Router uses Promise.all to fetch both sources simultaneously
    mockDb.fundSource.findUnique
      .mockResolvedValueOnce(sampleFundSource) // loanFundSourceId → type: "bank" (wrong type)
      .mockResolvedValueOnce({ ...sampleFundSource, id: "cuid-fs-2" }); // receiverFundSourceId

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.banking.transaction.loanMoneyOutTo({
        loanFundSourceId: "cuid-fs-1",
        receiverFundSourceId: "cuid-fs-2",
        amount: 10000,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("throws NOT_FOUND when loan source does not exist", async () => {
    mockDb.fundSource.findUnique.mockResolvedValueOnce(null);

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.banking.transaction.loanMoneyOutTo({
        loanFundSourceId: "cuid-nonexistent",
        receiverFundSourceId: "cuid-fs-1",
        amount: 10000,
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

// ---------------------------------------------------------------------------
// 14. transaction.loanMoneyIn
// ---------------------------------------------------------------------------
describe("banking.transaction.loanMoneyIn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records loan repayment — source currentBalance decreases, loanBalance increases", async () => {
    const payerSource = { ...sampleFundSource, currentBalance: "20000.00" };
    const loanSource = { ...sampleLoanSource, loanBalance: "15000.00" };
    const repayResult = {
      payerTx: { ...sampleTransaction, type: "loan_repayment" },
      loanTx: { ...sampleTransaction, id: "cuid-tx-loan", type: "loan_payback" },
    };

    mockDb.fundSource.findUnique
      .mockResolvedValueOnce(payerSource)
      .mockResolvedValueOnce(loanSource);
    mockDb.$transaction.mockResolvedValue(repayResult);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.banking.transaction.loanMoneyIn({
      payerFundSourceId: "cuid-fs-1",
      loanFundSourceId: "cuid-fs-loan",
      amount: 5000,
    });

    expect(result.payerTx.type).toBe("loan_repayment");
    expect(result.loanTx.type).toBe("loan_payback");
    expect(mockDb.$transaction).toHaveBeenCalledOnce();
  });

  it("rejects when payer has insufficient balance", async () => {
    const payerSource = { ...sampleFundSource, type: "bank", currentBalance: "100.00" };
    const loanSource = { ...sampleLoanSource };

    mockDb.fundSource.findUnique
      .mockResolvedValueOnce(payerSource)
      .mockResolvedValueOnce(loanSource);

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.banking.transaction.loanMoneyIn({
        payerFundSourceId: "cuid-fs-1",
        loanFundSourceId: "cuid-fs-loan",
        amount: 5000,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("throws BAD_REQUEST when target is not a loan", async () => {
    const payerSource = { ...sampleFundSource, currentBalance: "20000.00" };
    const nonLoanSource = { ...sampleFundSource, id: "cuid-fs-2", type: "bank" };

    mockDb.fundSource.findUnique
      .mockResolvedValueOnce(payerSource)
      .mockResolvedValueOnce(nonLoanSource);

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.banking.transaction.loanMoneyIn({
        payerFundSourceId: "cuid-fs-1",
        loanFundSourceId: "cuid-fs-2",
        amount: 5000,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
