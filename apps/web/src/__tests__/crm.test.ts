/**
 * Phase 8 Batch 2 Item 2: Module 3 CRM Phase 1 — Customer, CustomerContact, CustomerCreditAccount CRUD
 *
 * Covers:
 *  1. crm.customer.list — paginated list with isActive + tier filters
 *  2. crm.customer.byId — returns single customer or NOT_FOUND
 *  3. crm.customer.create — creates with required fields
 *  4. crm.customer.update — partial update of customer
 *  5. crm.customer.toggleActive — flips isActive boolean
 *  6. crm.contact.list — lists contacts for a customer
 *  7. crm.contact.create — creates a contact linked to customer
 *  8. crm.contact.update — partial update of contact
 *  9. crm.contact.delete — deletes a contact
 * 10. crm.credit.get — returns credit account for a customer or NOT_FOUND
 * 11. crm.credit.upsert — creates or updates credit account
 * 12. crm.credit.toggleActive — flips credit account isActive
 */
/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */

import { describe, it, expect, vi, beforeEach } from "vitest";

import { crmRouter } from "@/server/trpc/routers/crm";
import { createTRPCRouter, createCallerFactory } from "@/server/trpc/trpc";

vi.mock("@orqafy/db", () => {
  const mockPrisma = {
    customer: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    customerContact: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    customerCreditAccount: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    quotation: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    quotationSection: { create: vi.fn(), deleteMany: vi.fn() },
    quotationMarkupColumn: { create: vi.fn(), deleteMany: vi.fn() },
    quotationLineItem: { create: vi.fn() },
    quotationLineItemMarkup: { create: vi.fn() },
    quotationRevision: { create: vi.fn() },
    contactLog: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    invoice: {
      create: vi.fn(),
    },
    auditLog: { create: vi.fn() },
  };
  return {
    prisma: {
      ...mockPrisma,
      $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(mockPrisma)),
    },
    writeAuditLog: async (
      tx: { auditLog: { create: (args: unknown) => unknown } },
      entry: unknown,
    ) => { await tx.auditLog.create({ data: entry }); },
  };
});

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

const testRouter = createTRPCRouter({ crm: crmRouter });
const createCaller = createCallerFactory(testRouter);

import { prisma as db } from "@orqafy/db";
const mockDb = db as unknown as {
  customer: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  customerContact: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  customerCreditAccount: {
    findUnique: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  quotation: {
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  quotationSection: { create: ReturnType<typeof vi.fn>; deleteMany: ReturnType<typeof vi.fn> };
  quotationMarkupColumn: { create: ReturnType<typeof vi.fn>; deleteMany: ReturnType<typeof vi.fn> };
  quotationLineItem: { create: ReturnType<typeof vi.fn> };
  quotationLineItemMarkup: { create: ReturnType<typeof vi.fn> };
  quotationRevision: { create: ReturnType<typeof vi.fn> };
  contactLog: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  invoice: {
    create: ReturnType<typeof vi.fn>;
  };
  auditLog: {
    create: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

const sampleCustomer = {
  id: "cust-1",
  tenantId: "acme-tenant-id",
  companyName: "Acme Corp",
  firstName: "Juan",
  lastName: "dela Cruz",
  email: "juan@acme.ph",
  phone: "09171234567",
  address: "123 Main St",
  city: "Quezon City",
  province: "Metro Manila",
  postalCode: "1100",
  country: "PH",
  taxId: null,
  tier: "regular",
  notes: null,
  isActive: true,
  portalEnabled: false,
  portalEmail: null,
  portalPasswordHash: null,
  metadata: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

const sampleContact = {
  id: "contact-1",
  customerId: "cust-1",
  name: "Maria Santos",
  email: "maria@acme.ph",
  phone: "09181234567",
  position: "Purchasing Manager",
  isPrimary: true,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

const sampleCreditAccount = {
  id: "credit-1",
  tenantId: "acme-tenant-id",
  customerId: "cust-1",
  creditLimit: "50000.00",
  currentBalance: "0.00",
  isActive: true,
  approvedAt: new Date("2026-01-01"),
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

// ---------------------------------------------------------------------------
// 1. crm.customer.list
// ---------------------------------------------------------------------------
describe("crm.customer.list", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns paginated customers for authenticated user", async () => {
    mockDb.customer.findMany.mockResolvedValue([sampleCustomer]);
    mockDb.customer.count.mockResolvedValue(1);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.crm.customerList({ page: 1, limit: 50 });

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(50);
    expect(mockDb.customer.findMany).toHaveBeenCalledOnce();
  });

  it("filters by isActive when provided", async () => {
    mockDb.customer.findMany.mockResolvedValue([sampleCustomer]);
    mockDb.customer.count.mockResolvedValue(1);

    const caller = createCaller(authenticatedCtx());
    await caller.crm.customerList({ page: 1, limit: 50, isActive: true });

    const call = mockDb.customer.findMany.mock.calls[0] as [{ where: unknown }];
    expect(call[0].where).toMatchObject({ isActive: true });
  });

  it("filters by tier when provided", async () => {
    mockDb.customer.findMany.mockResolvedValue([sampleCustomer]);
    mockDb.customer.count.mockResolvedValue(1);

    const caller = createCaller(authenticatedCtx());
    await caller.crm.customerList({ page: 1, limit: 50, tier: "vip" });

    const call = mockDb.customer.findMany.mock.calls[0] as [{ where: unknown }];
    expect(call[0].where).toMatchObject({ tier: "vip" });
  });

  it("rejects unauthenticated requests", async () => {
    const caller = createCaller(unauthenticatedCtx());
    await expect(caller.crm.customerList({ page: 1, limit: 50 })).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 2. crm.customer.byId
// ---------------------------------------------------------------------------
describe("crm.customer.byId", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns a customer by id", async () => {
    mockDb.customer.findUnique.mockResolvedValue(sampleCustomer);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.crm.customerById({ id: "cust-1" });

    expect(result.id).toBe("cust-1");
    expect(result.firstName).toBe("Juan");
  });

  it("throws NOT_FOUND when customer does not exist", async () => {
    mockDb.customer.findUnique.mockResolvedValue(null);

    const caller = createCaller(authenticatedCtx());
    await expect(caller.crm.customerById({ id: "nonexistent" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

// ---------------------------------------------------------------------------
// 3. crm.customer.create
// ---------------------------------------------------------------------------
describe("crm.customer.create", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("creates a customer with required fields", async () => {
    const created = { ...sampleCustomer, id: "cust-new" };
    mockDb.customer.create.mockResolvedValue(created);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.crm.customerCreate({
      firstName: "Juan",
      lastName: "dela Cruz",
    });

    expect(result.id).toBe("cust-new");
    expect(mockDb.customer.create).toHaveBeenCalledOnce();
  });

  it("rejects demo tenant mutations", async () => {
    const demoCaller = createCaller({ ...authenticatedCtx(), isDemoTenant: true });
    await expect(
      demoCaller.crm.customerCreate({ firstName: "Test", lastName: "User" })
    ).rejects.toThrow();
  });

  it("writes an audit log row with action CREATE and entity Customer", async () => {
    const created = { ...sampleCustomer, id: "cust-audit" };
    mockDb.customer.create.mockResolvedValue(created);

    const caller = createCaller(authenticatedCtx());
    await caller.crm.customerCreate({ firstName: "Audit", lastName: "Test" });

    expect(mockDb.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "CREATE", entity: "Customer" }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// 4. crm.customer.update
// ---------------------------------------------------------------------------
describe("crm.customer.update", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("updates firstName and companyName", async () => {
    const updated = { ...sampleCustomer, firstName: "Pedro" };
    mockDb.customer.findUnique.mockResolvedValue(sampleCustomer);
    mockDb.customer.update.mockResolvedValue(updated);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.crm.customerUpdate({ id: "cust-1", firstName: "Pedro" });

    expect(result.firstName).toBe("Pedro");
    expect(mockDb.customer.update).toHaveBeenCalledOnce();
  });

  it("throws NOT_FOUND for nonexistent customer", async () => {
    mockDb.customer.findUnique.mockResolvedValue(null);

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.crm.customerUpdate({ id: "nonexistent", firstName: "X" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

// ---------------------------------------------------------------------------
// 5. crm.customer.toggleActive
// ---------------------------------------------------------------------------
describe("crm.customer.toggleActive", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("flips isActive from true to false", async () => {
    const existing = { ...sampleCustomer, isActive: true };
    const updated = { ...existing, isActive: false };
    mockDb.customer.findUnique.mockResolvedValue(existing);
    mockDb.customer.update.mockResolvedValue(updated);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.crm.customerToggleActive({ id: "cust-1" });

    expect(result.isActive).toBe(false);
    const call = mockDb.customer.update.mock.calls[0] as [{ data: { isActive: boolean } }];
    expect(call[0].data.isActive).toBe(false);
  });

  it("flips isActive from false to true", async () => {
    const existing = { ...sampleCustomer, isActive: false };
    const updated = { ...existing, isActive: true };
    mockDb.customer.findUnique.mockResolvedValue(existing);
    mockDb.customer.update.mockResolvedValue(updated);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.crm.customerToggleActive({ id: "cust-1" });

    expect(result.isActive).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 6. crm.contact.list
// ---------------------------------------------------------------------------
describe("crm.contact.list", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns contacts for a customer", async () => {
    mockDb.customerContact.findMany.mockResolvedValue([sampleContact]);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.crm.contactList({ customerId: "cust-1" });

    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("Maria Santos");
    expect(mockDb.customerContact.findMany).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// 7. crm.contact.create
// ---------------------------------------------------------------------------
describe("crm.contact.create", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("creates a contact linked to a customer", async () => {
    mockDb.customerContact.create.mockResolvedValue(sampleContact);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.crm.contactCreate({
      customerId: "cust-1",
      name: "Maria Santos",
    });

    expect(result.id).toBe("contact-1");
    expect(mockDb.customerContact.create).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// 8. crm.contact.update
// ---------------------------------------------------------------------------
describe("crm.contact.update", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("updates contact name", async () => {
    const updated = { ...sampleContact, name: "Maria Reyes" };
    mockDb.customerContact.findUnique.mockResolvedValue(sampleContact);
    mockDb.customerContact.update.mockResolvedValue(updated);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.crm.contactUpdate({ id: "contact-1", name: "Maria Reyes" });

    expect(result.name).toBe("Maria Reyes");
  });

  it("throws NOT_FOUND for nonexistent contact", async () => {
    mockDb.customerContact.findUnique.mockResolvedValue(null);

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.crm.contactUpdate({ id: "nonexistent", name: "X" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

// ---------------------------------------------------------------------------
// 9. crm.contact.delete
// ---------------------------------------------------------------------------
describe("crm.contact.delete", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("deletes a contact", async () => {
    mockDb.customerContact.findUnique.mockResolvedValue(sampleContact);
    mockDb.customerContact.delete.mockResolvedValue(sampleContact);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.crm.contactDelete({ id: "contact-1" });

    expect(result.id).toBe("contact-1");
    expect(mockDb.customerContact.delete).toHaveBeenCalledOnce();
  });

  it("throws NOT_FOUND for nonexistent contact", async () => {
    mockDb.customerContact.findUnique.mockResolvedValue(null);

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.crm.contactDelete({ id: "nonexistent" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

// ---------------------------------------------------------------------------
// 10. crm.credit.get
// ---------------------------------------------------------------------------
describe("crm.credit.get", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns credit account for a customer", async () => {
    mockDb.customerCreditAccount.findUnique.mockResolvedValue(sampleCreditAccount);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.crm.creditGet({ customerId: "cust-1" });

    expect(result).not.toBeNull();
    expect(result!.id).toBe("credit-1");
  });

  it("returns null when no credit account exists", async () => {
    mockDb.customerCreditAccount.findUnique.mockResolvedValue(null);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.crm.creditGet({ customerId: "cust-1" });

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 11. crm.credit.upsert
// ---------------------------------------------------------------------------
describe("crm.credit.upsert", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("creates or updates credit account", async () => {
    mockDb.customerCreditAccount.upsert.mockResolvedValue(sampleCreditAccount);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.crm.creditUpsert({
      customerId: "cust-1",
      creditLimit: 50000,
    });

    expect(result.id).toBe("credit-1");
    expect(mockDb.customerCreditAccount.upsert).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// 12. crm.credit.toggleActive
// ---------------------------------------------------------------------------
describe("crm.credit.toggleActive", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("flips credit account isActive from true to false", async () => {
    const existing = { ...sampleCreditAccount, isActive: true };
    const updated = { ...existing, isActive: false };
    mockDb.customerCreditAccount.findUnique.mockResolvedValue(existing);
    mockDb.customerCreditAccount.update.mockResolvedValue(updated);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.crm.creditToggleActive({ customerId: "cust-1" });

    expect(result.isActive).toBe(false);
  });

  it("throws NOT_FOUND when credit account does not exist", async () => {
    mockDb.customerCreditAccount.findUnique.mockResolvedValue(null);

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.crm.creditToggleActive({ customerId: "cust-1" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

// ===========================================================================
// PHASE 8 BATCH 9 — Quotation procedures (CRM Phase 2)
// ===========================================================================

const QUOTATION_ID = "ck1234567890123456789012q";
const CUSTOMER_ID = "ck1234567890123456789012c";

const sampleQuotation = {
  id: QUOTATION_ID,
  tenantId: "acme-tenant-id",
  quotationNumber: "QT-2605-0001",
  customerId: CUSTOMER_ID,
  createdById: "user-1",
  title: "Q1 Marine Equipment Quote",
  status: "draft",
  validUntil: new Date("2026-06-30"),
  subtotal: "1500.00",
  taxAmount: "180.00",
  totalAmount: "1680.00",
  currency: "PHP",
  notes: null,
  termsAndConditions: null,
  convertedToInvoiceId: null,
  sentAt: null,
  acceptedAt: null,
  metadata: null,
  createdAt: new Date("2026-05-16"),
  updatedAt: new Date("2026-05-16"),
};

// ---------------------------------------------------------------------------
// 13. crm.quotationList
// ---------------------------------------------------------------------------
describe("crm.quotationList", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns paginated quotations for authenticated user", async () => {
    mockDb.quotation.findMany.mockResolvedValue([sampleQuotation]);
    mockDb.quotation.count.mockResolvedValue(1);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.crm.quotationList({ page: 1, limit: 50 });

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it("filters by status when provided", async () => {
    mockDb.quotation.findMany.mockResolvedValue([sampleQuotation]);
    mockDb.quotation.count.mockResolvedValue(1);

    const caller = createCaller(authenticatedCtx());
    await caller.crm.quotationList({ page: 1, limit: 50, status: "sent" });

    const call = mockDb.quotation.findMany.mock.calls[0] as [{ where: unknown }];
    expect(call[0].where).toMatchObject({ status: "sent" });
  });

  it("filters by customerId when provided", async () => {
    mockDb.quotation.findMany.mockResolvedValue([sampleQuotation]);
    mockDb.quotation.count.mockResolvedValue(1);

    const caller = createCaller(authenticatedCtx());
    await caller.crm.quotationList({ page: 1, limit: 50, customerId: CUSTOMER_ID });

    const call = mockDb.quotation.findMany.mock.calls[0] as [{ where: unknown }];
    expect(call[0].where).toMatchObject({ customerId: CUSTOMER_ID });
  });
});

// ---------------------------------------------------------------------------
// 14. crm.quotationById
// ---------------------------------------------------------------------------
describe("crm.quotationById", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns a quotation with nested sections + markups + revisions", async () => {
    mockDb.quotation.findFirst.mockResolvedValue({
      ...sampleQuotation,
      customer: sampleCustomer,
      createdBy: { id: "user-1", firstName: "Bo", lastName: "N", displayName: null },
      markupColumns: [],
      sections: [],
      revisions: [{ id: "rev-1", revisionNumber: 1, createdAt: new Date() }],
    });

    const caller = createCaller(authenticatedCtx());
    const result = await caller.crm.quotationById({ id: QUOTATION_ID });

    expect(result.id).toBe(QUOTATION_ID);
    expect(result.revisions).toHaveLength(1);
  });

  it("throws NOT_FOUND when quotation does not exist", async () => {
    mockDb.quotation.findFirst.mockResolvedValue(null);

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.crm.quotationById({ id: QUOTATION_ID }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

// ---------------------------------------------------------------------------
// 15. crm.quotationCreate
// ---------------------------------------------------------------------------
describe("crm.quotationCreate", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  function setupHappyPath() {
    mockDb.customer.findUnique.mockResolvedValue({ id: CUSTOMER_ID, tenantId: "acme-tenant-id" });
    mockDb.quotation.findFirst.mockResolvedValue(null); // generateQuotationNumber
    mockDb.$transaction.mockImplementation((fn: (tx: typeof mockDb) => Promise<unknown>): unknown =>
      fn(mockDb),
    );
    mockDb.quotation.create.mockResolvedValue({ ...sampleQuotation });
    mockDb.quotationMarkupColumn.create.mockImplementation(({ data }: { data: unknown }): unknown =>
      Promise.resolve({ id: `mc-${Math.random()}`, ...(data as object) }),
    );
    mockDb.quotationSection.create.mockImplementation(({ data }: { data: unknown }): unknown =>
      Promise.resolve({ id: `sec-${Math.random()}`, ...(data as object) }),
    );
    mockDb.quotationLineItem.create.mockImplementation(({ data }: { data: unknown }): unknown =>
      Promise.resolve({ id: `li-${Math.random()}`, ...(data as object) }),
    );
    mockDb.quotationLineItemMarkup.create.mockResolvedValue({ id: "lim-1" });
    mockDb.quotationRevision.create.mockResolvedValue({ id: "rev-1" });
  }

  it("creates quotation + sections + line items atomically with correct totals", async () => {
    setupHappyPath();

    const caller = createCaller(authenticatedCtx());
    await caller.crm.quotationCreate({
      customerId: CUSTOMER_ID,
      title: "Test Quote",
      taxAmount: 180,
      markupColumns: [
        { name: "Tier 1", tier: "tier1", percentage: 20, useCeiling: false, sortOrder: 0 },
        { name: "Tier 2", tier: "tier2", percentage: 35, useCeiling: false, sortOrder: 1 },
      ],
      sections: [
        {
          name: "Section A",
          sortOrder: 0,
          lineItems: [
            {
              description: "Widget",
              unit: "pcs",
              quantity: 2,
              baseCost: 500,
              sortOrder: 0,
              markups: [
                { markupColumnIndex: 0, markedUpPrice: 600 },
                { markupColumnIndex: 1, markedUpPrice: 675 },
              ],
            },
            {
              description: "Gizmo",
              unit: "pcs",
              quantity: 1,
              baseCost: 500,
              sortOrder: 1,
              markups: [],
            },
          ],
        },
      ],
    });

    // Transaction wrapper called once.
    expect(mockDb.$transaction).toHaveBeenCalledTimes(1);
    // Quotation row: subtotal = 2*500 + 1*500 = 1500; total = 1500 + 180 = 1680.
    expect(mockDb.quotation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        customerId: CUSTOMER_ID,
        title: "Test Quote",
        status: "draft",
        subtotal: 1500,
        taxAmount: 180,
        totalAmount: 1680,
        createdById: "user-1",
      }),
    });
    // 2 markup columns.
    expect(mockDb.quotationMarkupColumn.create).toHaveBeenCalledTimes(2);
    // 1 section.
    expect(mockDb.quotationSection.create).toHaveBeenCalledTimes(1);
    // 2 line items.
    expect(mockDb.quotationLineItem.create).toHaveBeenCalledTimes(2);
    // 2 markups on line item 1, 0 on line item 2 → 2 total.
    expect(mockDb.quotationLineItemMarkup.create).toHaveBeenCalledTimes(2);
    // Initial revision snapshot.
    expect(mockDb.quotationRevision.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        revisionNumber: 1,
        snapshot: expect.objectContaining({ status: "draft" }),
      }),
    });
  });

  it("auto-generates quotation number in QT-YYMM-NNNN format", async () => {
    setupHappyPath();
    // No prior quotations → seq starts at 1.
    mockDb.quotation.findFirst.mockResolvedValue(null);

    const caller = createCaller(authenticatedCtx());
    await caller.crm.quotationCreate({
      customerId: CUSTOMER_ID,
      title: "Q",
      taxAmount: 0,
      markupColumns: [],
      sections: [
        {
          name: "S",
          sortOrder: 0,
          lineItems: [
            { description: "X", unit: "pcs", quantity: 1, baseCost: 100, sortOrder: 0, markups: [] },
          ],
        },
      ],
    });

    const created = mockDb.quotation.create.mock.calls[0] as [{ data: { quotationNumber: string } }];
    expect(created[0].data.quotationNumber).toMatch(/^QT-\d{4}-0001$/);
  });

  it("increments sequence number when prior quotations exist this month", async () => {
    setupHappyPath();
    mockDb.quotation.findFirst.mockResolvedValue({ quotationNumber: "QT-2605-0042" });

    const caller = createCaller(authenticatedCtx());
    await caller.crm.quotationCreate({
      customerId: CUSTOMER_ID,
      title: "Q",
      taxAmount: 0,
      markupColumns: [],
      sections: [
        {
          name: "S",
          sortOrder: 0,
          lineItems: [
            { description: "X", unit: "pcs", quantity: 1, baseCost: 100, sortOrder: 0, markups: [] },
          ],
        },
      ],
    });

    const created = mockDb.quotation.create.mock.calls[0] as [{ data: { quotationNumber: string } }];
    expect(created[0].data.quotationNumber).toMatch(/^QT-\d{4}-0043$/);
  });

  it("throws NOT_FOUND when customer does not exist", async () => {
    mockDb.customer.findUnique.mockResolvedValue(null);

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.crm.quotationCreate({
        customerId: CUSTOMER_ID,
        title: "Q",
        taxAmount: 0,
        markupColumns: [],
        sections: [
          {
            name: "S",
            sortOrder: 0,
            lineItems: [
              { description: "X", unit: "pcs", quantity: 1, baseCost: 100, sortOrder: 0, markups: [] },
            ],
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it("rejects when markupColumnIndex is out of range", async () => {
    setupHappyPath();

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.crm.quotationCreate({
        customerId: CUSTOMER_ID,
        title: "Q",
        taxAmount: 0,
        markupColumns: [
          { name: "Tier 1", tier: "tier1", percentage: 20, useCeiling: false, sortOrder: 0 },
        ],
        sections: [
          {
            name: "S",
            sortOrder: 0,
            lineItems: [
              {
                description: "X",
                unit: "pcs",
                quantity: 1,
                baseCost: 100,
                sortOrder: 0,
                markups: [{ markupColumnIndex: 5, markedUpPrice: 120 }], // index 5 doesn't exist
              },
            ],
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

// ---------------------------------------------------------------------------
// 16. crm.quotationUpdate
// ---------------------------------------------------------------------------
describe("crm.quotationUpdate", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("updates a draft quotation", async () => {
    mockDb.quotation.findUnique.mockResolvedValue({ id: QUOTATION_ID, tenantId: "acme-tenant-id", status: "draft" });
    mockDb.quotation.update.mockResolvedValue({ ...sampleQuotation, title: "Updated Title" });

    const caller = createCaller(authenticatedCtx());
    const result = await caller.crm.quotationUpdate({
      id: QUOTATION_ID,
      title: "Updated Title",
    });

    expect(result.title).toBe("Updated Title");
    const call = mockDb.quotation.update.mock.calls[0] as [{ data: { title?: string } }];
    expect(call[0].data.title).toBe("Updated Title");
  });

  it("rejects edits on non-draft quotations", async () => {
    mockDb.quotation.findUnique.mockResolvedValue({ id: QUOTATION_ID, tenantId: "acme-tenant-id", status: "sent" });

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.crm.quotationUpdate({ id: QUOTATION_ID, title: "X" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mockDb.quotation.update).not.toHaveBeenCalled();
  });

  it("throws NOT_FOUND when quotation does not exist", async () => {
    mockDb.quotation.findUnique.mockResolvedValue(null);

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.crm.quotationUpdate({ id: QUOTATION_ID, title: "X" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("replaces sections + markupColumns and recomputes totals on full-payload edit", async () => {
    mockDb.quotation.findUnique.mockResolvedValue({ id: QUOTATION_ID, tenantId: "acme-tenant-id", status: "draft" });
    mockDb.$transaction.mockImplementation(
      (fn: (tx: typeof mockDb) => Promise<unknown>): unknown => fn(mockDb),
    );
    mockDb.quotationSection.deleteMany.mockResolvedValue({ count: 2 });
    mockDb.quotationMarkupColumn.deleteMany.mockResolvedValue({ count: 1 });
    mockDb.quotationMarkupColumn.create.mockImplementation(({ data }: { data: unknown }): unknown =>
      Promise.resolve({ id: "col-new-1", ...(data as object) }),
    );
    mockDb.quotationSection.create.mockImplementation(({ data }: { data: unknown }): unknown =>
      Promise.resolve({ id: "sec-new-1", ...(data as object) }),
    );
    mockDb.quotationLineItem.create.mockImplementation(({ data }: { data: unknown }): unknown =>
      Promise.resolve({ id: "li-new-1", ...(data as object) }),
    );
    mockDb.quotationLineItemMarkup.create.mockResolvedValue({ id: "lim-new-1" });
    mockDb.quotation.update.mockResolvedValue({
      ...sampleQuotation,
      title: "Replaced",
      subtotal: 250,
      taxAmount: 25,
      totalAmount: 275,
    });

    const caller = createCaller(authenticatedCtx());
    const result = await caller.crm.quotationUpdate({
      id: QUOTATION_ID,
      title: "Replaced",
      taxAmount: 25,
      markupColumns: [
        { name: "Tier 1", tier: "tier1", percentage: 20, useCeiling: false, sortOrder: 0 },
      ],
      sections: [
        {
          name: "S1",
          sortOrder: 0,
          lineItems: [
            {
              description: "Widget",
              unit: "pcs",
              quantity: 5,
              baseCost: 50,
              sortOrder: 0,
              markups: [{ markupColumnIndex: 0, markedUpPrice: 60 }],
            },
          ],
        },
      ],
    });

    expect(result.title).toBe("Replaced");
    expect(mockDb.$transaction).toHaveBeenCalledTimes(1);
    expect(mockDb.quotationSection.deleteMany).toHaveBeenCalledWith({
      where: { quotationId: QUOTATION_ID },
    });
    expect(mockDb.quotationMarkupColumn.deleteMany).toHaveBeenCalledWith({
      where: { quotationId: QUOTATION_ID },
    });
    expect(mockDb.quotationMarkupColumn.create).toHaveBeenCalledTimes(1);
    expect(mockDb.quotationSection.create).toHaveBeenCalledTimes(1);
    expect(mockDb.quotationLineItem.create).toHaveBeenCalledTimes(1);
    expect(mockDb.quotationLineItemMarkup.create).toHaveBeenCalledTimes(1);

    const updateCall = mockDb.quotation.update.mock.calls.at(-1) as [
      { data: { subtotal: number; taxAmount: number; totalAmount: number } },
    ];
    expect(updateCall[0].data.subtotal).toBe(250);
    expect(updateCall[0].data.taxAmount).toBe(25);
    expect(updateCall[0].data.totalAmount).toBe(275);
  });

  it("rejects partial full-payload (sections without markupColumns)", async () => {
    mockDb.quotation.findUnique.mockResolvedValue({ id: QUOTATION_ID, tenantId: "acme-tenant-id", status: "draft" });
    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.crm.quotationUpdate({
        id: QUOTATION_ID,
        sections: [
          { name: "S1", sortOrder: 0, lineItems: [] },
        ],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 17. crm.quotationSend
// ---------------------------------------------------------------------------
describe("crm.quotationSend", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("flips status draft → sent and sets sentAt", async () => {
    mockDb.quotation.findUnique.mockResolvedValue({ id: QUOTATION_ID, tenantId: "acme-tenant-id", status: "draft" });
    mockDb.quotation.update.mockResolvedValue({
      ...sampleQuotation,
      status: "sent",
      sentAt: new Date(),
    });

    const caller = createCaller(authenticatedCtx());
    const result = await caller.crm.quotationSend({ id: QUOTATION_ID });

    expect(result.status).toBe("sent");
    const call = mockDb.quotation.update.mock.calls[0] as [{ data: { status: string; sentAt: Date } }];
    expect(call[0].data.status).toBe("sent");
    expect(call[0].data.sentAt).toBeInstanceOf(Date);
  });

  it("rejects non-draft quotations", async () => {
    mockDb.quotation.findUnique.mockResolvedValue({ id: QUOTATION_ID, tenantId: "acme-tenant-id", status: "sent" });

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.crm.quotationSend({ id: QUOTATION_ID }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

// ---------------------------------------------------------------------------
// 18. crm.quotationAccept / quotationReject
// ---------------------------------------------------------------------------
describe("crm.quotationAccept", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("flips status sent → accepted and sets acceptedAt", async () => {
    mockDb.quotation.findUnique.mockResolvedValue({ id: QUOTATION_ID, tenantId: "acme-tenant-id", status: "sent" });
    mockDb.quotation.update.mockResolvedValue({
      ...sampleQuotation,
      status: "accepted",
      acceptedAt: new Date(),
    });

    const caller = createCaller(authenticatedCtx());
    const result = await caller.crm.quotationAccept({ id: QUOTATION_ID });

    expect(result.status).toBe("accepted");
    const call = mockDb.quotation.update.mock.calls[0] as [{ data: { status: string; acceptedAt: Date } }];
    expect(call[0].data.status).toBe("accepted");
    expect(call[0].data.acceptedAt).toBeInstanceOf(Date);
  });

  it("rejects accept on non-sent quotations", async () => {
    mockDb.quotation.findUnique.mockResolvedValue({ id: QUOTATION_ID, tenantId: "acme-tenant-id", status: "draft" });

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.crm.quotationAccept({ id: QUOTATION_ID }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("crm.quotationReject", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("flips status sent → rejected", async () => {
    mockDb.quotation.findUnique.mockResolvedValue({ id: QUOTATION_ID, tenantId: "acme-tenant-id", status: "sent" });
    mockDb.quotation.update.mockResolvedValue({ ...sampleQuotation, status: "rejected" });

    const caller = createCaller(authenticatedCtx());
    const result = await caller.crm.quotationReject({ id: QUOTATION_ID });

    expect(result.status).toBe("rejected");
  });

  it("rejects reject on non-sent quotations", async () => {
    mockDb.quotation.findUnique.mockResolvedValue({ id: QUOTATION_ID, tenantId: "acme-tenant-id", status: "draft" });

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.crm.quotationReject({ id: QUOTATION_ID }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

// ---------------------------------------------------------------------------
// 19. crm.quotationCreateRevision
// ---------------------------------------------------------------------------
describe("crm.quotationCreateRevision", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("snapshots current state, increments revisionNumber, and resets to draft", async () => {
    mockDb.quotation.findFirst.mockResolvedValue({
      id: QUOTATION_ID,
      tenantId: "acme-tenant-id",
      status: "sent",
      subtotal: { toString: () => "1500.00" },
      taxAmount: { toString: () => "180.00" },
      totalAmount: { toString: () => "1680.00" },
      markupColumns: [],
      sections: [],
      revisions: [{ revisionNumber: 1 }],
    });
    mockDb.$transaction.mockImplementation((fn: (tx: typeof mockDb) => Promise<unknown>): unknown =>
      fn(mockDb),
    );
    mockDb.quotationRevision.create.mockResolvedValue({ id: "rev-2" });
    mockDb.quotation.update.mockResolvedValue({ ...sampleQuotation, status: "draft" });

    const caller = createCaller(authenticatedCtx());
    const result = await caller.crm.quotationCreateRevision({ id: QUOTATION_ID });

    expect(result.status).toBe("draft");
    expect(mockDb.$transaction).toHaveBeenCalledTimes(1);
    expect(mockDb.quotationRevision.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        revisionNumber: 2,
        snapshot: expect.objectContaining({ status: "sent" }),
      }),
    });
    expect(mockDb.quotation.update).toHaveBeenCalledWith({
      where: { id: QUOTATION_ID },
      data: { status: "draft" },
    });
  });

  it("rejects revision on converted quotations", async () => {
    mockDb.quotation.findFirst.mockResolvedValue({
      id: QUOTATION_ID,
      tenantId: "acme-tenant-id",
      status: "converted",
      subtotal: { toString: () => "0" },
      taxAmount: { toString: () => "0" },
      totalAmount: { toString: () => "0" },
      markupColumns: [],
      sections: [],
      revisions: [{ revisionNumber: 3 }],
    });

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.crm.quotationCreateRevision({ id: QUOTATION_ID }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 20. Demo tenant blocking on quotation writes
// ---------------------------------------------------------------------------
describe("crm.quotation* demo tenant blocking", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  function demoCtx() {
    return {
      req: makeReq(),
      userId: "user-1",
      roles: ["Administrator"],
      tenantSlug: "demo",
      tenantId: "demo-tenant-id",
      securityVersion: 1,
      isDemoTenant: true,
      session: null,
    };
  }

  it("blocks quotationCreate on demo tenant", async () => {
    const caller = createCaller(demoCtx());
    await expect(
      caller.crm.quotationCreate({
        customerId: CUSTOMER_ID,
        title: "Q",
        taxAmount: 0,
        markupColumns: [],
        sections: [
          {
            name: "S",
            sortOrder: 0,
            lineItems: [
              { description: "X", unit: "pcs", quantity: 1, baseCost: 100, sortOrder: 0, markups: [] },
            ],
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("blocks quotationSend on demo tenant", async () => {
    const caller = createCaller(demoCtx());
    await expect(
      caller.crm.quotationSend({ id: QUOTATION_ID }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

// ---------------------------------------------------------------------------
// crm.contactLog.* — touchpoint log per customer
// ---------------------------------------------------------------------------

const CONTACT_LOG_ID = "log-1";
const sampleContactLog = {
  id: CONTACT_LOG_ID,
  tenantId: "acme-tenant-id",
  customerId: "cust-1",
  createdById: "user-1",
  type: "call",
  subject: "Discovery call",
  body: "Discussed Q1 hardware refresh.",
  occurredAt: new Date("2026-05-15"),
  createdAt: new Date("2026-05-15"),
  updatedAt: new Date("2026-05-15"),
};

describe("crm.contactLog.list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns paginated logs ordered by occurredAt desc", async () => {
    mockDb.contactLog.findMany.mockResolvedValue([sampleContactLog]);
    mockDb.contactLog.count.mockResolvedValue(1);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.crm.contactLogList({ page: 1, limit: 50 });

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    const call = mockDb.contactLog.findMany.mock.calls[0] as [{ orderBy: unknown }];
    expect(call[0].orderBy).toMatchObject({ occurredAt: "desc" });
  });

  it("filters by customerId when provided", async () => {
    mockDb.contactLog.findMany.mockResolvedValue([]);
    mockDb.contactLog.count.mockResolvedValue(0);

    const caller = createCaller(authenticatedCtx());
    await caller.crm.contactLogList({ page: 1, limit: 50, customerId: "cust-1" });

    const call = mockDb.contactLog.findMany.mock.calls[0] as [{ where: unknown }];
    expect(call[0].where).toMatchObject({ customerId: "cust-1" });
  });

  it("filters by type when provided", async () => {
    mockDb.contactLog.findMany.mockResolvedValue([]);
    mockDb.contactLog.count.mockResolvedValue(0);

    const caller = createCaller(authenticatedCtx());
    await caller.crm.contactLogList({ page: 1, limit: 50, type: "email" });

    const call = mockDb.contactLog.findMany.mock.calls[0] as [{ where: unknown }];
    expect(call[0].where).toMatchObject({ type: "email" });
  });

  it("rejects unauthenticated requests", async () => {
    const caller = createCaller(unauthenticatedCtx());
    await expect(
      caller.crm.contactLogList({ page: 1, limit: 50 }),
    ).rejects.toThrow();
  });
});

describe("crm.contactLog.byId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the log when found", async () => {
    mockDb.contactLog.findFirst.mockResolvedValue(sampleContactLog);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.crm.contactLogById({ id: CONTACT_LOG_ID });

    expect(result.id).toBe(CONTACT_LOG_ID);
    expect(result.subject).toBe("Discovery call");
  });

  it("throws NOT_FOUND when log does not exist", async () => {
    mockDb.contactLog.findFirst.mockResolvedValue(null);

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.crm.contactLogById({ id: "missing" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("crm.contactLog.listForCustomer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("scopes findMany to the given customer", async () => {
    mockDb.contactLog.findMany.mockResolvedValue([sampleContactLog]);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.crm.contactLogListForCustomer({
      customerId: "cust-1",
      limit: 25,
    });

    expect(result).toHaveLength(1);
    const call = mockDb.contactLog.findMany.mock.calls[0] as [
      { where: unknown; take: unknown },
    ];
    expect(call[0].where).toMatchObject({ customerId: "cust-1" });
    expect(call[0].take).toBe(25);
  });
});

describe("crm.contactLog.create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a log with default occurredAt when not provided", async () => {
    mockDb.customer.findUnique.mockResolvedValue({ id: "cust-1", tenantId: "acme-tenant-id" });
    mockDb.contactLog.create.mockResolvedValue(sampleContactLog);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.crm.contactLogCreate({
      customerId: "cust-1",
      type: "call",
      subject: "Follow-up",
    });

    expect(result.id).toBe(CONTACT_LOG_ID);
    const call = mockDb.contactLog.create.mock.calls[0] as [
      { data: { occurredAt: Date; createdById: string } },
    ];
    expect(call[0].data.createdById).toBe("user-1");
    expect(call[0].data.occurredAt).toBeInstanceOf(Date);
  });

  it("uses the provided occurredAt when supplied", async () => {
    mockDb.customer.findUnique.mockResolvedValue({ id: "cust-1", tenantId: "acme-tenant-id" });
    mockDb.contactLog.create.mockResolvedValue(sampleContactLog);

    const specific = new Date("2026-04-01T10:00:00Z");
    const caller = createCaller(authenticatedCtx());
    await caller.crm.contactLogCreate({
      customerId: "cust-1",
      type: "meeting",
      subject: "Quarterly review",
      occurredAt: specific,
    });

    const call = mockDb.contactLog.create.mock.calls[0] as [
      { data: { occurredAt: Date } },
    ];
    expect(call[0].data.occurredAt).toEqual(specific);
  });

  it("throws NOT_FOUND when customer is missing", async () => {
    mockDb.customer.findUnique.mockResolvedValue(null);

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.crm.contactLogCreate({
        customerId: "missing",
        type: "call",
        subject: "X",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("crm.contactLog.update", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates only provided fields", async () => {
    mockDb.contactLog.findUnique.mockResolvedValue({ id: CONTACT_LOG_ID, tenantId: "acme-tenant-id" });
    mockDb.contactLog.update.mockResolvedValue({
      ...sampleContactLog,
      subject: "Updated subject",
    });

    const caller = createCaller(authenticatedCtx());
    await caller.crm.contactLogUpdate({
      id: CONTACT_LOG_ID,
      subject: "Updated subject",
    });

    const call = mockDb.contactLog.update.mock.calls[0] as [
      { data: Record<string, unknown> },
    ];
    expect(call[0].data).toMatchObject({ subject: "Updated subject" });
    expect(call[0].data).not.toHaveProperty("type");
    expect(call[0].data).not.toHaveProperty("body");
  });

  it("throws NOT_FOUND when log does not exist", async () => {
    mockDb.contactLog.findUnique.mockResolvedValue(null);

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.crm.contactLogUpdate({ id: "missing", subject: "X" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("crm.contactLog.delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes the log and returns its id", async () => {
    mockDb.contactLog.findUnique.mockResolvedValue({ id: CONTACT_LOG_ID, tenantId: "acme-tenant-id" });
    mockDb.contactLog.delete.mockResolvedValue(sampleContactLog);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.crm.contactLogDelete({ id: CONTACT_LOG_ID });

    expect(result).toEqual({ id: CONTACT_LOG_ID });
    expect(mockDb.contactLog.delete).toHaveBeenCalledWith({
      where: { id: CONTACT_LOG_ID },
    });
  });

  it("throws NOT_FOUND when log does not exist", async () => {
    mockDb.contactLog.findUnique.mockResolvedValue(null);

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.crm.contactLogDelete({ id: "missing" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("crm.contactLog demo tenant blocking", () => {
  function demoCtx() {
    return {
      req: makeReq(),
      userId: "user-1",
      roles: ["Administrator"],
      tenantSlug: "demo",
      tenantId: "demo-tenant-id",
      securityVersion: 1,
      isDemoTenant: true,
      session: null,
    };
  }

  it("blocks contactLogCreate on demo tenant", async () => {
    const caller = createCaller(demoCtx());
    await expect(
      caller.crm.contactLogCreate({
        customerId: "cust-1",
        type: "call",
        subject: "Demo",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("blocks contactLogDelete on demo tenant", async () => {
    const caller = createCaller(demoCtx());
    await expect(
      caller.crm.contactLogDelete({ id: CONTACT_LOG_ID }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

// ---------------------------------------------------------------------------
// 20. crm.quotationConvertToInvoice
// ---------------------------------------------------------------------------
describe("crm.quotationConvertToInvoice", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  function acceptedQuotationFixture(overrides: Record<string, unknown> = {}) {
    return {
      id: QUOTATION_ID,
      tenantId: "acme-tenant-id",
      status: "accepted",
      convertedToInvoiceId: null,
      customerId: "cust-1",
      currency: "PHP",
      subtotal: 1000,
      taxAmount: 120,
      totalAmount: 1120,
      termsAndConditions: "Net 30",
      markupColumns: [
        { id: "col-1", sortOrder: 0, name: "Tier 1", tier: "tier1" },
      ],
      sections: [
        {
          id: "sec-1",
          sortOrder: 0,
          lineItems: [
            {
              id: "li-1",
              description: "Widget A",
              quantity: 2,
              baseCost: 100,
              sortOrder: 0,
              markups: [
                { markupColumnId: "col-1", markedUpPrice: 150 },
              ],
            },
            {
              id: "li-2",
              description: "Widget B",
              quantity: 1,
              baseCost: 200,
              sortOrder: 1,
              markups: [
                { markupColumnId: "col-1", markedUpPrice: 300 },
              ],
            },
          ],
        },
      ],
      ...overrides,
    };
  }

  it("creates invoice from accepted quotation and flips status to converted", async () => {
    mockDb.quotation.findFirst.mockResolvedValue(acceptedQuotationFixture());
    mockDb.$transaction.mockImplementation(
      (fn: (tx: typeof mockDb) => Promise<unknown>): unknown => fn(mockDb),
    );
    mockDb.invoice.create.mockResolvedValue({
      id: "inv-new",
      invoiceNumber: "INV-1700000000000",
    });
    mockDb.quotation.update.mockResolvedValue({});

    const caller = createCaller(authenticatedCtx());
    const result = await caller.crm.quotationConvertToInvoice({
      id: QUOTATION_ID,
    });

    expect(result).toMatchObject({ id: "inv-new" });

    // subtotal = 2*150 + 1*300 = 600
    // taxRate = 120/1000 = 0.12 → taxAmount = 600*0.12 = 72
    // total = 672
    const invoiceCall = mockDb.invoice.create.mock.calls[0] as [
      {
        data: {
          customerId: string;
          quotationId: string;
          subtotal: number;
          taxAmount: number;
          totalAmount: number;
          balance: number;
          currency: string;
          lineItems: Array<{
            description: string;
            quantity: number;
            unitPrice: number;
          }>;
          termsAndConditions?: string;
        };
        select: unknown;
      },
    ];
    const data = invoiceCall[0].data;
    expect(data.customerId).toBe("cust-1");
    expect(data.quotationId).toBe(QUOTATION_ID);
    expect(data.subtotal).toBeCloseTo(600);
    expect(data.taxAmount).toBeCloseTo(72);
    expect(data.totalAmount).toBeCloseTo(672);
    expect(data.balance).toBeCloseTo(672);
    expect(data.currency).toBe("PHP");
    expect(data.lineItems).toHaveLength(2);
    expect(data.lineItems[0]).toMatchObject({
      description: "Widget A",
      quantity: 2,
      unitPrice: 150,
    });
    expect(data.termsAndConditions).toBe("Net 30");

    // Quotation flipped to converted with invoice FK
    const updateCall = mockDb.quotation.update.mock.calls[0] as [
      { data: { status: string; convertedToInvoiceId: string } },
    ];
    expect(updateCall[0].data.status).toBe("converted");
    expect(updateCall[0].data.convertedToInvoiceId).toBe("inv-new");
  });

  it("uses explicit markupColumnId when provided", async () => {
    mockDb.quotation.findFirst.mockResolvedValue(
      acceptedQuotationFixture({
        markupColumns: [
          { id: "col-1", sortOrder: 0, name: "Tier 1", tier: "tier1" },
          { id: "col-2", sortOrder: 1, name: "Tier 2", tier: "tier2" },
        ],
        sections: [
          {
            id: "sec-1",
            sortOrder: 0,
            lineItems: [
              {
                id: "li-1",
                description: "Widget A",
                quantity: 2,
                baseCost: 100,
                sortOrder: 0,
                markups: [
                  { markupColumnId: "col-1", markedUpPrice: 150 },
                  { markupColumnId: "col-2", markedUpPrice: 200 },
                ],
              },
            ],
          },
        ],
      }),
    );
    mockDb.$transaction.mockImplementation(
      (fn: (tx: typeof mockDb) => Promise<unknown>): unknown => fn(mockDb),
    );
    mockDb.invoice.create.mockResolvedValue({
      id: "inv-new",
      invoiceNumber: "INV-X",
    });
    mockDb.quotation.update.mockResolvedValue({});

    const caller = createCaller(authenticatedCtx());
    await caller.crm.quotationConvertToInvoice({
      id: QUOTATION_ID,
      markupColumnId: "col-2",
    });

    const invoiceCall = mockDb.invoice.create.mock.calls[0] as [
      {
        data: {
          subtotal: number;
          lineItems: Array<{ unitPrice: number }>;
        };
      },
    ];
    // Used col-2: 2 * 200 = 400
    expect(invoiceCall[0].data.subtotal).toBeCloseTo(400);
    expect(invoiceCall[0].data.lineItems[0]?.unitPrice).toBe(200);
  });

  it("blocks conversion when quotation is not accepted", async () => {
    mockDb.quotation.findFirst.mockResolvedValue(
      acceptedQuotationFixture({ status: "draft" }),
    );

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.crm.quotationConvertToInvoice({ id: QUOTATION_ID }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("blocks conversion when quotation is already converted", async () => {
    mockDb.quotation.findFirst.mockResolvedValue(
      acceptedQuotationFixture({ convertedToInvoiceId: "inv-existing" }),
    );

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.crm.quotationConvertToInvoice({ id: QUOTATION_ID }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("throws NOT_FOUND when quotation does not exist", async () => {
    mockDb.quotation.findFirst.mockResolvedValue(null);

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.crm.quotationConvertToInvoice({ id: "missing" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("blocks conversion on demo tenant", async () => {
    const demoCtx = {
      req: makeReq(),
      userId: "user-1",
      roles: ["Administrator"],
      tenantSlug: "demo",
      tenantId: "demo-tenant-id",
      securityVersion: 1,
      isDemoTenant: true,
      session: null,
    };
    const caller = createCaller(demoCtx);
    await expect(
      caller.crm.quotationConvertToInvoice({ id: QUOTATION_ID }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
