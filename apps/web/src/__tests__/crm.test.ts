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

vi.mock("@orqafy/db", () => ({
  prisma: {
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
  },
}));

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
};

const sampleCustomer = {
  id: "cust-1",
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
