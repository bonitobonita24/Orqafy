/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
/**
 * GAP 1 — invoice.create always generates a non-null unique publicToken.
 *
 * Proves:
 *  1. invoice.create returns a non-null publicToken on every call
 *  2. two successive calls produce distinct tokens (uniqueness)
 *  3. the token stored in db.invoice.create data is a non-empty string
 *  4. invoice.publicView resolves the invoice when given the correct token
 *  5. invoice.publicView throws NOT_FOUND for an unknown token (no enumeration)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type * as OrqafyDb from "@orqafy/db";

// ── DB mock (hoisted) ─────────────────────────────────────────────────────────
const { mockInvoiceCreate, mockInvoiceFindUnique, mockCustomerFindUnique, mockRoleFindFirst, mockRolePermissionFindUnique } =
  vi.hoisted(() => ({
    mockInvoiceCreate: vi.fn(),
    mockInvoiceFindUnique: vi.fn(),
    mockCustomerFindUnique: vi.fn(),
    mockRoleFindFirst: vi.fn(),
    mockRolePermissionFindUnique: vi.fn(),
  }));

// invoice.create is now gated by the "invoices"/"create" RBAC matrix
// (writeProcedure.use(matrixMiddleware(...))) — mock role/rolePermission
// alongside the existing invoice/customer mocks so hasPermission() resolves.
// publicView stays on publicProcedure (ungated) and needs no role mock.
vi.mock("@orqafy/db", async () => {
  const actual = await vi.importActual<typeof OrqafyDb>("@orqafy/db");
  return {
    ...actual,
    prisma: {
      invoice: {
        findMany: vi.fn(),
        findUnique: mockInvoiceFindUnique,
        create: mockInvoiceCreate,
        update: vi.fn(),
        count: vi.fn(),
      },
      customer: {
        findUnique: mockCustomerFindUnique,
      },
      role: { findFirst: mockRoleFindFirst },
      rolePermission: { findUnique: mockRolePermissionFindUnique },
    },
    writeAuditLog: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("@/server/lib/rate-limit", () => ({
  rateLimiters: {
    api: { check: vi.fn() },
    public: { check: vi.fn() },
    public_invoice: { check: vi.fn() },
  },
}));

vi.mock("@/server/lib/sanitize", () => ({
  sanitizePlainText: (s: string) => s,
}));

vi.mock("@/server/notifications/create", () => ({
  createNotification: vi.fn().mockResolvedValue({ id: "notif-stub" }),
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────
import { invoiceRouter } from "@/server/trpc/routers/invoice";
import { createTRPCRouter, createCallerFactory } from "@/server/trpc/trpc";
import type { NextRequest } from "next/server";

const testRouter = createTRPCRouter({ invoice: invoiceRouter });
const createCaller = createCallerFactory(testRouter);

function makeReq(ip?: string): NextRequest {
  return {
    headers: { get: (h: string): string | null => (h === "x-forwarded-for" ? (ip ?? "127.0.0.1") : null) },
  } as unknown as NextRequest;
}

function authenticatedCtx(tenantId = "tenant-a") {
  return {
    req: makeReq(),
    userId: "user-1",
    roles: ["Administrator"] as string[],
    roleId: "role-1",
    tenantSlug: "acme",
    tenantId,
    securityVersion: 1,
    isDemoTenant: false,
    session: null,
  };
}

function publicCtx() {
  return {
    req: makeReq(),
    userId: null,
    roles: [] as string[],
    roleId: null,
    tenantSlug: null,
    tenantId: null,
    securityVersion: 0,
    isDemoTenant: false,
    session: null,
  };
}

const BASE_INPUT = {
  customerId: "clcustomer0000000000001",
  dueDate: new Date("2026-07-31"),
  lineItems: [{ description: "Widget", quantity: 2, unitPrice: 1500 }],
};

const STUB_CUSTOMER = {
  id: "clcustomer0000000000001",
  tenantId: "tenant-a",
  firstName: "Ana",
  lastName: "Reyes",
  companyName: null,
};

// Helper: build a fake invoice row the mock returns from db.invoice.create
function stubInvoiceRow(publicToken: string) {
  return {
    id: "clinvoice000000000000001",
    tenantId: "tenant-a",
    invoiceNumber: "INV-stub",
    customerId: STUB_CUSTOMER.id,
    createdById: "user-1",
    status: "draft",
    subtotal: 3000,
    totalAmount: 3000,
    amountPaid: 0,
    balance: 3000,
    currency: "PHP",
    dueDate: BASE_INPUT.dueDate,
    lineItems: BASE_INPUT.lineItems,
    notes: null,
    publicToken,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("invoice.create — publicToken generation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: Platform Owner bypasses the "invoices"/"create" matrix check
    // entirely, preserving the original publicToken assertions below.
    mockRoleFindFirst.mockResolvedValue({ id: "role-1", tenantId: "tenant-a", name: "Platform Owner" });
  });

  it("returns a non-null publicToken on every create", async () => {
    mockCustomerFindUnique.mockResolvedValue(STUB_CUSTOMER);
    // Capture what the router passes to db.invoice.create and echo back a real token
    mockInvoiceCreate.mockImplementation(({ data }: { data: any }) => Promise.resolve(stubInvoiceRow(data.publicToken as string)));

    const caller = createCaller(authenticatedCtx());
    const result = await caller.invoice.create(BASE_INPUT);

    expect(result.publicToken).toBeTruthy();
    expect(typeof result.publicToken).toBe("string");
    expect((result.publicToken as string).length).toBeGreaterThan(0);
  });

  it("persists publicToken in the db.invoice.create data payload", async () => {
    mockCustomerFindUnique.mockResolvedValue(STUB_CUSTOMER);
    mockInvoiceCreate.mockImplementation(({ data }: { data: any }) => Promise.resolve(stubInvoiceRow(data.publicToken as string)));

    const caller = createCaller(authenticatedCtx());
    await caller.invoice.create(BASE_INPUT);

    const createCall = mockInvoiceCreate.mock.calls[0]?.[0] as { data: any };
    expect(createCall.data.publicToken).toBeTruthy();
    expect(typeof createCall.data.publicToken).toBe("string");
    expect((createCall.data.publicToken as string).length).toBeGreaterThan(0);
  });

  it("generates a distinct token on each call (uniqueness)", async () => {
    mockCustomerFindUnique.mockResolvedValue(STUB_CUSTOMER);
    mockInvoiceCreate.mockImplementation(({ data }: { data: any }) => Promise.resolve(stubInvoiceRow(data.publicToken as string)));

    const caller = createCaller(authenticatedCtx());
    const [r1, r2] = await Promise.all([
      caller.invoice.create(BASE_INPUT),
      caller.invoice.create(BASE_INPUT),
    ]);

    expect(r1.publicToken).not.toBe(r2.publicToken);
  });
});

describe("invoice.publicView — token-based public access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns customer-facing invoice fields for a valid token", async () => {
    const token = "test-token-abc123";
    mockInvoiceFindUnique.mockResolvedValue({
      ...stubInvoiceRow(token),
      customer: { firstName: "Ana", lastName: "Reyes", companyName: null, email: "ana@example.com" },
      project: null,
    });

    const caller = createCaller(publicCtx());
    const result = await caller.invoice.publicView({ token });

    expect(result.id).toBe("clinvoice000000000000001");
    expect(result.invoiceNumber).toBe("INV-stub");
    expect(result.status).toBe("draft");
    expect(result.customer).toMatchObject({ firstName: "Ana", lastName: "Reyes" });
    // Sensitive internal fields must not leak
    expect((result as any).tenantId).toBeUndefined();
    expect((result as any).createdById).toBeUndefined();
  });

  it("throws NOT_FOUND for an unknown token (prevents enumeration via status code)", async () => {
    mockInvoiceFindUnique.mockResolvedValue(null);

    const caller = createCaller(publicCtx());
    await expect(caller.invoice.publicView({ token: "no-such-token" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
