/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
/**
 * Direction M-1 — CRM CustomerContact tenant parity
 *
 * Proves:
 *  1. contactList rejects cross-tenant customer
 *  2. contactCreate rejects cross-tenant customer
 *  3. contactUpdate rejects cross-tenant contact (via parent customer check)
 *  4. contactDelete rejects cross-tenant contact (via parent customer check)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type * as OrqafyDb from "@orqafy/db";

// ── DB mock (hoisted so vi.mock factory can reference) ────────────────────────
const { mockCustomerFindUnique, mockContactFindMany, mockContactCreate, mockContactFindUnique, mockContactUpdate, mockContactDelete, mockRoleFindFirst, mockRolePermissionFindUnique } = vi.hoisted(() => ({
  mockCustomerFindUnique: vi.fn(),
  mockContactFindMany: vi.fn(),
  mockContactCreate: vi.fn(),
  mockContactFindUnique: vi.fn(),
  mockContactUpdate: vi.fn(),
  mockContactDelete: vi.fn(),
  mockRoleFindFirst: vi.fn(),
  mockRolePermissionFindUnique: vi.fn(),
}));

vi.mock("@orqafy/db", async () => {
  const actual = await vi.importActual<typeof OrqafyDb>("@orqafy/db");
  return {
    ...actual,
    prisma: {
      customer: { findUnique: mockCustomerFindUnique, findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
      customerContact: { findMany: mockContactFindMany, create: mockContactCreate, findUnique: mockContactFindUnique, update: mockContactUpdate, delete: mockContactDelete },
      customerCreditAccount: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
      customerCreditTransaction: { findMany: vi.fn(), create: vi.fn() },
      quotation: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
      quotationSection: { findMany: vi.fn(), create: vi.fn(), createMany: vi.fn(), deleteMany: vi.fn(), update: vi.fn() },
      quotationMarkupColumn: { findMany: vi.fn(), create: vi.fn(), createMany: vi.fn(), deleteMany: vi.fn() },
      quotationLineItem: { findMany: vi.fn(), create: vi.fn(), createMany: vi.fn(), deleteMany: vi.fn() },
      quotationLineItemMarkup: { findMany: vi.fn(), create: vi.fn(), createMany: vi.fn(), deleteMany: vi.fn() },
      quotationRevision: { findMany: vi.fn(), create: vi.fn() },
      contactLog: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
      invoice: { create: vi.fn() },
      role: { findFirst: mockRoleFindFirst },
      rolePermission: { findUnique: mockRolePermissionFindUnique },
      $transaction: vi.fn(),
    },
  };
});

vi.mock("@/server/lib/rate-limit", () => ({
  rateLimiters: { api: { check: vi.fn() }, public: { check: vi.fn() } },
}));

vi.mock("@/server/lib/sanitize", () => ({
  sanitizePlainText: (s: string) => s,
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
    roleId: "role-1",
    tenantSlug: "test",
    tenantId,
    securityVersion: 1,
    isDemoTenant: false,
    session: null,
  };
}

const TENANT_A = "tenant-aaa";
const TENANT_B = "tenant-bbb";
const CUSTOMER_A = { id: "cust-a", tenantId: TENANT_A };
const CUSTOMER_B = { id: "cust-b", tenantId: TENANT_B };
const CONTACT_OF_CUST_A = { id: "contact-a", customerId: "cust-a" };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("CRM CustomerContact tenant-parity (Direction M-1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Matrix middleware bypass by default — these tests assert tenant-isolation
    // (IDOR) behavior, not RBAC grant/deny (covered by crm-matrix.test.ts).
    mockRoleFindFirst.mockResolvedValue({
      id: "role-1",
      tenantId: TENANT_A,
      name: "Platform Owner",
    });
  });

  it("contactList rejects cross-tenant customer", async () => {
    mockCustomerFindUnique.mockResolvedValueOnce(CUSTOMER_B);
    const caller = createCaller(ctxForTenant(TENANT_A));
    await expect(
      caller.crm.contactList({ customerId: "cust-b" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("contactCreate rejects cross-tenant customer", async () => {
    mockCustomerFindUnique.mockResolvedValueOnce(CUSTOMER_B);
    const caller = createCaller(ctxForTenant(TENANT_A));
    await expect(
      caller.crm.contactCreate({ customerId: "cust-b", name: "Evil Contact" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("contactUpdate rejects cross-tenant contact", async () => {
    mockContactFindUnique.mockResolvedValueOnce(CONTACT_OF_CUST_A);
    mockCustomerFindUnique.mockResolvedValueOnce(CUSTOMER_A);
    const caller = createCaller(ctxForTenant(TENANT_B));
    await expect(
      caller.crm.contactUpdate({ id: "contact-a", name: "Hacked" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("contactDelete rejects cross-tenant contact", async () => {
    mockContactFindUnique.mockResolvedValueOnce(CONTACT_OF_CUST_A);
    mockCustomerFindUnique.mockResolvedValueOnce(CUSTOMER_A);
    const caller = createCaller(ctxForTenant(TENANT_B));
    await expect(
      caller.crm.contactDelete({ id: "contact-a" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
