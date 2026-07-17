/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/require-await */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { posRouter } from "@/server/trpc/routers/pos";
import { createTRPCRouter, createCallerFactory } from "@/server/trpc/trpc";
import { TRPCError } from "@trpc/server";
import type * as OrqafyDb from "@orqafy/db";

// Keep the real `hasPermission` resolver (matrix.ts imports it directly from
// "@orqafy/db") — only mock the prisma client calls it and the router make.
// Router migrated to the data-driven `role_permissions` matrix (feature key
// "pos") — matrixMiddleware resolves the caller's role via role.findFirst.
// Every ctx below defaults to roleId "role-1" and role name "Platform Owner"
// so the matrix bypasses entirely (this suite proves business logic, not
// matrix grant/deny behaviour — see pos-matrix.test.ts for that coverage).
vi.mock("@orqafy/db", async () => {
  const actual = await vi.importActual<typeof OrqafyDb>("@orqafy/db");
  return {
    ...actual,
    prisma: {
      pOSSession: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      pOSSale: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        aggregate: vi.fn(),
      },
      pOSSaleItem: {
        create: vi.fn(),
      },
      product: {
        findMany: vi.fn(),
      },
      warehouse: {
        findFirst: vi.fn(),
      },
      customer: {
        findFirst: vi.fn(),
      },
      stockMovement: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
      role: {
        findFirst: vi.fn(),
      },
      rolePermission: {
        findUnique: vi.fn(),
      },
      $transaction: vi.fn(),
    },
  };
});

vi.mock("@/server/lib/rate-limit", () => ({
  rateLimiters: {
    api: { check: vi.fn() },
  },
}));

import type { NextRequest } from "next/server";
function makeReq(): NextRequest {
  return {
    headers: { get: (_h: string): string | null => null },
  } as unknown as NextRequest;
}
function authenticatedCtx(roles: string[] = ["Administrator"], isDemoTenant = false) {
  return {
    req: makeReq(),
    userId: "user-1",
    roles,
    roleId: "role-1",
    tenantSlug: "acme",
    tenantId: "acme-tenant-id",
    securityVersion: 1,
    isDemoTenant,
    session: null,
  };
}
function unauthenticatedCtx() {
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

const testRouter = createTRPCRouter({ pos: posRouter });
const createCaller = createCallerFactory(testRouter);

import { prisma as db } from "@orqafy/db";
const mockDb = db as unknown as {
  pOSSession: {
    findFirst: any;
    findUnique: any;
    findMany: any;
    count: any;
    create: any;
    update: any;
  };
  pOSSale: {
    findFirst: any;
    findUnique: any;
    findMany: any;
    count: any;
    create: any;
    update: any;
    aggregate: any;
  };
  pOSSaleItem: { create: any };
  product: { findMany: any };
  warehouse: { findFirst: any };
  customer: { findFirst: any };
  stockMovement: { create: any; findMany: any };
  role: { findFirst: any };
  rolePermission: { findUnique: any };
  $transaction: any;
};

const SESSION_ID = "ck1234567890123456789012a";
const SALE_ID = "ck1234567890123456789012b";
const PRODUCT_A = "ck1234567890123456789012c";
const PRODUCT_B = "ck1234567890123456789012d";
const WAREHOUSE_ID = "ck1234567890123456789012e";
const CUSTOMER_ID = "ck1234567890123456789012f";

beforeEach(() => {
  vi.clearAllMocks();
  // Every test's caller resolves to a "Platform Owner" role, which bypasses
  // the "pos" matrix entirely (tenant-rbac-standard.md §4) — this suite
  // exercises business logic, not matrix grant/deny behaviour (see
  // pos-matrix.test.ts for that coverage).
  mockDb.role.findFirst.mockResolvedValue({
    id: "role-1",
    tenantId: "acme-tenant-id",
    name: "Platform Owner",
  });
});

// ── session.list ──────────────────────────────────────────────────────────────

describe("pos.session.list", () => {
  it("returns paginated sessions with default skip/take", async () => {
    mockDb.pOSSession.findMany.mockResolvedValue([
      {
        id: SESSION_ID,
        sessionNumber: "POS-2605-0001",
        userId: "user-1",
        status: "open",
        openingBalance: 5000,
        openedAt: new Date("2026-05-15"),
        user: { id: "user-1", firstName: "Bo", lastName: "Nito", displayName: null },
        _count: { sales: 3 },
      },
    ]);
    mockDb.pOSSession.count.mockResolvedValue(1);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.pos.session.list({});

    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(mockDb.pOSSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: "acme-tenant-id" }, skip: 0, take: 20 }),
    );
  });

  it("filters by status and userId", async () => {
    mockDb.pOSSession.findMany.mockResolvedValue([]);
    mockDb.pOSSession.count.mockResolvedValue(0);

    const userId = "ck1234567890123456789012g";
    const caller = createCaller(authenticatedCtx());
    await caller.pos.session.list({ status: "closed", userId });

    expect(mockDb.pOSSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "acme-tenant-id", status: "closed", userId },
      }),
    );
  });

  it("rejects unauthenticated callers", async () => {
    const caller = createCaller(unauthenticatedCtx());
    await expect(caller.pos.session.list({})).rejects.toBeInstanceOf(TRPCError);
  });
});

// ── session.byId ──────────────────────────────────────────────────────────────

describe("pos.session.byId", () => {
  it("returns session with user + sales", async () => {
    mockDb.pOSSession.findFirst.mockResolvedValue({
      id: SESSION_ID,
      sessionNumber: "POS-2605-0001",
      status: "open",
      user: { id: "user-1", firstName: "Bo", lastName: "Nito", displayName: null },
      sales: [],
    });

    const caller = createCaller(authenticatedCtx());
    const result = await caller.pos.session.byId({ id: SESSION_ID });
    expect(result.sessionNumber).toBe("POS-2605-0001");
  });

  it("throws NOT_FOUND when missing", async () => {
    mockDb.pOSSession.findFirst.mockResolvedValue(null);
    const caller = createCaller(authenticatedCtx());
    await expect(caller.pos.session.byId({ id: SESSION_ID })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

// ── session.open ──────────────────────────────────────────────────────────────

describe("pos.session.open", () => {
  it("creates a new session with auto-numbered sessionNumber when none open exists", async () => {
    mockDb.pOSSession.findFirst
      .mockResolvedValueOnce(null) // no existing open session
      .mockResolvedValueOnce(null); // no prior session in this YYMM (generateSessionNumber)
    mockDb.pOSSession.create.mockResolvedValue({
      id: SESSION_ID,
      sessionNumber: "POS-2605-0001",
      status: "open",
      openingBalance: 5000,
    });

    const caller = createCaller(authenticatedCtx());
    const result = await caller.pos.session.open({ openingBalance: 5000 });

    expect(result.id).toBe(SESSION_ID);
    expect(mockDb.pOSSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sessionNumber: expect.stringMatching(/^POS-\d{4}-\d{4}$/),
        userId: "user-1",
        openingBalance: 5000,
        status: "open",
      }),
    });
  });

  it("rejects when the user already has an open session (CONFLICT)", async () => {
    mockDb.pOSSession.findFirst.mockResolvedValueOnce({
      id: SESSION_ID,
      sessionNumber: "POS-2605-0007",
    });

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.pos.session.open({ openingBalance: 5000 }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(mockDb.pOSSession.create).not.toHaveBeenCalled();
  });

  it("blocks mutations on demo tenant", async () => {
    const caller = createCaller(authenticatedCtx(["Administrator"], true));
    await expect(
      caller.pos.session.open({ openingBalance: 5000 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects negative openingBalance via Zod", async () => {
    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.pos.session.open({ openingBalance: -100 }),
    ).rejects.toBeInstanceOf(TRPCError);
  });
});

// ── session.close ─────────────────────────────────────────────────────────────

describe("pos.session.close", () => {
  it("computes expectedBalance = opening + cash sales, discrepancy = closing - expected", async () => {
    mockDb.pOSSession.findFirst.mockResolvedValue({
      id: SESSION_ID,
      openingBalance: 5000,
      status: "open",
    });
    mockDb.pOSSale.aggregate.mockResolvedValue({
      _sum: { totalAmount: 3000 },
    });
    mockDb.pOSSession.update.mockResolvedValue({ id: SESSION_ID });

    const caller = createCaller(authenticatedCtx());
    await caller.pos.session.close({ id: SESSION_ID, closingBalance: 7950 });

    expect(mockDb.pOSSale.aggregate).toHaveBeenCalledWith({
      where: {
        sessionId: SESSION_ID,
        status: "completed",
        paymentMethod: "cash",
      },
      _sum: { totalAmount: true },
    });
    expect(mockDb.pOSSession.update).toHaveBeenCalledWith({
      where: { id: SESSION_ID },
      data: expect.objectContaining({
        status: "closed",
        closingBalance: 7950,
        expectedBalance: 8000,
        discrepancy: -50,
        closedAt: expect.any(Date),
      }),
    });
  });

  it("handles a session with no cash sales (discrepancy = closing - opening)", async () => {
    mockDb.pOSSession.findFirst.mockResolvedValue({
      id: SESSION_ID,
      openingBalance: 5000,
      status: "open",
    });
    mockDb.pOSSale.aggregate.mockResolvedValue({ _sum: { totalAmount: null } });
    mockDb.pOSSession.update.mockResolvedValue({ id: SESSION_ID });

    const caller = createCaller(authenticatedCtx());
    await caller.pos.session.close({ id: SESSION_ID, closingBalance: 5000 });

    const call = mockDb.pOSSession.update.mock.calls[0][0];
    expect(call.data.expectedBalance).toBe(5000);
    expect(call.data.discrepancy).toBe(0);
  });

  it("rejects when session is already closed", async () => {
    mockDb.pOSSession.findFirst.mockResolvedValue({
      id: SESSION_ID,
      openingBalance: 5000,
      status: "closed",
    });
    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.pos.session.close({ id: SESSION_ID, closingBalance: 5000 }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects when session not found", async () => {
    mockDb.pOSSession.findFirst.mockResolvedValue(null);
    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.pos.session.close({ id: SESSION_ID, closingBalance: 5000 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("blocks mutations on demo tenant", async () => {
    const caller = createCaller(authenticatedCtx(["Administrator"], true));
    await expect(
      caller.pos.session.close({ id: SESSION_ID, closingBalance: 5000 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

// ── sale.list ─────────────────────────────────────────────────────────────────

describe("pos.sale.list", () => {
  it("returns paginated sales", async () => {
    mockDb.pOSSale.findMany.mockResolvedValue([
      {
        id: SALE_ID,
        saleNumber: "SALE-2605-0001",
        sessionId: SESSION_ID,
        totalAmount: 1500,
        paymentMethod: "cash",
        status: "completed",
        _count: { items: 3 },
      },
    ]);
    mockDb.pOSSale.count.mockResolvedValue(1);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.pos.sale.list({});
    expect(result.total).toBe(1);
    expect(result.items[0]?.saleNumber).toBe("SALE-2605-0001");
  });

  it("filters by sessionId, status, and paymentMethod", async () => {
    mockDb.pOSSale.findMany.mockResolvedValue([]);
    mockDb.pOSSale.count.mockResolvedValue(0);

    const caller = createCaller(authenticatedCtx());
    await caller.pos.sale.list({
      sessionId: SESSION_ID,
      status: "completed",
      paymentMethod: "gcash",
    });

    expect(mockDb.pOSSale.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: "acme-tenant-id",
          sessionId: SESSION_ID,
          status: "completed",
          paymentMethod: "gcash",
        },
      }),
    );
  });
});

// ── sale.byId ─────────────────────────────────────────────────────────────────

describe("pos.sale.byId", () => {
  it("returns the sale with items and session", async () => {
    mockDb.pOSSale.findFirst.mockResolvedValue({
      id: SALE_ID,
      saleNumber: "SALE-2605-0001",
      items: [],
      session: { id: SESSION_ID, sessionNumber: "POS-2605-0001", status: "open" },
    });
    const caller = createCaller(authenticatedCtx());
    const result = await caller.pos.sale.byId({ id: SALE_ID });
    expect(result.session.status).toBe("open");
  });

  it("throws NOT_FOUND when missing", async () => {
    mockDb.pOSSale.findFirst.mockResolvedValue(null);
    const caller = createCaller(authenticatedCtx());
    await expect(caller.pos.sale.byId({ id: SALE_ID })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

// ── sale.create (atomic) ──────────────────────────────────────────────────────

describe("pos.sale.create", () => {
  function setupHappyPath() {
    mockDb.pOSSession.findFirst.mockResolvedValue({
      id: SESSION_ID,
      status: "open",
    });
    // Echo back exactly the IDs requested so single-item tests pass too.
    mockDb.product.findMany.mockImplementation(({ where }: any) => {
      const ids: string[] = where?.id?.in ?? [];
      return Promise.resolve(ids.map((id) => ({ id })));
    });
    mockDb.warehouse.findFirst.mockResolvedValue({ id: WAREHOUSE_ID });
    mockDb.customer.findFirst.mockResolvedValue({ id: CUSTOMER_ID });
    mockDb.pOSSale.findFirst.mockResolvedValue(null); // generateSaleNumber
    mockDb.$transaction.mockImplementation(async (fn: any) => fn(mockDb));
    mockDb.pOSSale.create.mockResolvedValue({
      id: SALE_ID,
      saleNumber: "SALE-2605-0001",
      totalAmount: 1500,
    });
    mockDb.pOSSaleItem.create.mockResolvedValue({ id: "item-1" });
    mockDb.stockMovement.create.mockResolvedValue({ id: "sm-1" });
  }

  it("creates sale + items + stockMovements atomically (cash sale w/ change)", async () => {
    setupHappyPath();

    const caller = createCaller(authenticatedCtx());
    const result = await caller.pos.sale.create({
      sessionId: SESSION_ID,
      warehouseId: WAREHOUSE_ID,
      customerId: CUSTOMER_ID,
      paymentMethod: "cash",
      amountPaid: 2000,
      items: [
        {
          productId: PRODUCT_A,
          description: "Mouse",
          quantity: 2,
          unitPrice: 500,
        },
        {
          productId: PRODUCT_B,
          description: "Cable",
          quantity: 1,
          unitPrice: 500,
        },
      ],
    });

    expect(result.id).toBe(SALE_ID);

    // Transaction wrapper called once.
    expect(mockDb.$transaction).toHaveBeenCalledTimes(1);

    // Sale row: subtotal=1500, total=1500, change=500.
    expect(mockDb.pOSSale.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sessionId: SESSION_ID,
        customerId: CUSTOMER_ID,
        subtotal: 1500,
        totalAmount: 1500,
        amountPaid: 2000,
        changeAmount: 500,
        paymentMethod: "cash",
        status: "completed",
      }),
    });

    // Two line items.
    expect(mockDb.pOSSaleItem.create).toHaveBeenCalledTimes(2);
    expect(mockDb.pOSSaleItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productId: PRODUCT_A,
        quantity: 2,
        unitPrice: 500,
        totalPrice: 1000,
      }),
    });

    // Two stock movements (type=out, fromWarehouseId, referenceType=pos_sale).
    expect(mockDb.stockMovement.create).toHaveBeenCalledTimes(2);
    expect(mockDb.stockMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productId: PRODUCT_A,
        type: "out",
        quantity: 2,
        fromWarehouseId: WAREHOUSE_ID,
        referenceType: "pos_sale",
        referenceId: SALE_ID,
        createdById: "user-1",
      }),
    });
  });

  it("applies tax and discount (subtotal + tax - discount = total)", async () => {
    setupHappyPath();
    mockDb.pOSSale.create.mockResolvedValue({
      id: SALE_ID,
      totalAmount: 1180,
    });

    const caller = createCaller(authenticatedCtx());
    await caller.pos.sale.create({
      sessionId: SESSION_ID,
      warehouseId: WAREHOUSE_ID,
      paymentMethod: "cash",
      amountPaid: 1200,
      taxAmount: 200,
      discountAmount: 20,
      items: [
        {
          productId: PRODUCT_A,
          description: "Item",
          quantity: 2,
          unitPrice: 500,
        },
      ],
    });

    expect(mockDb.pOSSale.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        subtotal: 1000,
        taxAmount: 200,
        discountAmount: 20,
        totalAmount: 1180,
        amountPaid: 1200,
        changeAmount: 20,
      }),
    });
  });

  it("rejects when session is closed", async () => {
    mockDb.pOSSession.findFirst.mockResolvedValue({
      id: SESSION_ID,
      status: "closed",
    });

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.pos.sale.create({
        sessionId: SESSION_ID,
        warehouseId: WAREHOUSE_ID,
        paymentMethod: "cash",
        amountPaid: 500,
        items: [
          {
            productId: PRODUCT_A,
            description: "X",
            quantity: 1,
            unitPrice: 500,
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it("rejects when session not found", async () => {
    mockDb.pOSSession.findFirst.mockResolvedValue(null);

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.pos.sale.create({
        sessionId: SESSION_ID,
        warehouseId: WAREHOUSE_ID,
        paymentMethod: "cash",
        amountPaid: 500,
        items: [
          {
            productId: PRODUCT_A,
            description: "X",
            quantity: 1,
            unitPrice: 500,
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects when a referenced product does not exist", async () => {
    mockDb.pOSSession.findFirst.mockResolvedValue({
      id: SESSION_ID,
      status: "open",
    });
    mockDb.product.findMany.mockResolvedValue([{ id: PRODUCT_A }]); // Only one of two

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.pos.sale.create({
        sessionId: SESSION_ID,
        warehouseId: WAREHOUSE_ID,
        paymentMethod: "cash",
        amountPaid: 1000,
        items: [
          { productId: PRODUCT_A, description: "A", quantity: 1, unitPrice: 500 },
          { productId: PRODUCT_B, description: "B", quantity: 1, unitPrice: 500 },
        ],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it("rejects payment method outside the enum (cash | gcash | maya | card | credit)", async () => {
    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.pos.sale.create({
        sessionId: SESSION_ID,
        warehouseId: WAREHOUSE_ID,
        paymentMethod: "btc" as any,
        amountPaid: 500,
        items: [
          { productId: PRODUCT_A, description: "X", quantity: 1, unitPrice: 500 },
        ],
      }),
    ).rejects.toBeInstanceOf(TRPCError);
  });

  it("rejects empty items array", async () => {
    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.pos.sale.create({
        sessionId: SESSION_ID,
        warehouseId: WAREHOUSE_ID,
        paymentMethod: "cash",
        amountPaid: 0,
        items: [],
      }),
    ).rejects.toBeInstanceOf(TRPCError);
  });

  it("rejects amountPaid less than totalAmount", async () => {
    mockDb.pOSSession.findFirst.mockResolvedValue({
      id: SESSION_ID,
      status: "open",
    });
    mockDb.product.findMany.mockResolvedValue([{ id: PRODUCT_A }]);

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.pos.sale.create({
        sessionId: SESSION_ID,
        warehouseId: WAREHOUSE_ID,
        paymentMethod: "cash",
        amountPaid: 100,
        items: [
          { productId: PRODUCT_A, description: "X", quantity: 1, unitPrice: 500 },
        ],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("requires non-cash payments to equal totalAmount exactly", async () => {
    mockDb.pOSSession.findFirst.mockResolvedValue({
      id: SESSION_ID,
      status: "open",
    });
    mockDb.product.findMany.mockResolvedValue([{ id: PRODUCT_A }]);

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.pos.sale.create({
        sessionId: SESSION_ID,
        warehouseId: WAREHOUSE_ID,
        paymentMethod: "gcash",
        amountPaid: 600,
        items: [
          { productId: PRODUCT_A, description: "X", quantity: 1, unitPrice: 500 },
        ],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("accepts non-cash exact-amount payments (gcash) with zero changeAmount", async () => {
    setupHappyPath();
    mockDb.pOSSale.create.mockResolvedValue({ id: SALE_ID, totalAmount: 500 });

    const caller = createCaller(authenticatedCtx());
    await caller.pos.sale.create({
      sessionId: SESSION_ID,
      warehouseId: WAREHOUSE_ID,
      paymentMethod: "gcash",
      amountPaid: 500,
      items: [
        { productId: PRODUCT_A, description: "X", quantity: 1, unitPrice: 500 },
      ],
    });

    expect(mockDb.pOSSale.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        paymentMethod: "gcash",
        amountPaid: 500,
        changeAmount: 0,
      }),
    });
  });

  it("rejects a cross-tenant warehouseId (M7.2 IDOR closure)", async () => {
    mockDb.pOSSession.findFirst.mockResolvedValue({
      id: SESSION_ID,
      status: "open",
    });
    mockDb.product.findMany.mockResolvedValue([{ id: PRODUCT_A }]);
    mockDb.warehouse.findFirst.mockResolvedValue(null); // belongs to another tenant

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.pos.sale.create({
        sessionId: SESSION_ID,
        warehouseId: WAREHOUSE_ID,
        paymentMethod: "cash",
        amountPaid: 500,
        items: [
          { productId: PRODUCT_A, description: "X", quantity: 1, unitPrice: 500 },
        ],
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mockDb.warehouse.findFirst).toHaveBeenCalledWith({
      where: { id: WAREHOUSE_ID, tenantId: "acme-tenant-id" },
      select: { id: true },
    });
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a cross-tenant customerId (M7.2 IDOR closure)", async () => {
    mockDb.pOSSession.findFirst.mockResolvedValue({
      id: SESSION_ID,
      status: "open",
    });
    mockDb.product.findMany.mockResolvedValue([{ id: PRODUCT_A }]);
    mockDb.warehouse.findFirst.mockResolvedValue({ id: WAREHOUSE_ID });
    mockDb.customer.findFirst.mockResolvedValue(null); // belongs to another tenant

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.pos.sale.create({
        sessionId: SESSION_ID,
        warehouseId: WAREHOUSE_ID,
        customerId: CUSTOMER_ID,
        paymentMethod: "cash",
        amountPaid: 500,
        items: [
          { productId: PRODUCT_A, description: "X", quantity: 1, unitPrice: 500 },
        ],
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mockDb.customer.findFirst).toHaveBeenCalledWith({
      where: { id: CUSTOMER_ID, tenantId: "acme-tenant-id" },
      select: { id: true },
    });
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it("rejects when discount exceeds subtotal + tax (negative total)", async () => {
    mockDb.pOSSession.findFirst.mockResolvedValue({
      id: SESSION_ID,
      status: "open",
    });
    mockDb.product.findMany.mockResolvedValue([{ id: PRODUCT_A }]);

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.pos.sale.create({
        sessionId: SESSION_ID,
        warehouseId: WAREHOUSE_ID,
        paymentMethod: "cash",
        amountPaid: 0,
        discountAmount: 9999,
        items: [
          { productId: PRODUCT_A, description: "X", quantity: 1, unitPrice: 500 },
        ],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("blocks mutations on demo tenant", async () => {
    const caller = createCaller(authenticatedCtx(["Administrator"], true));
    await expect(
      caller.pos.sale.create({
        sessionId: SESSION_ID,
        warehouseId: WAREHOUSE_ID,
        paymentMethod: "cash",
        amountPaid: 500,
        items: [
          { productId: PRODUCT_A, description: "X", quantity: 1, unitPrice: 500 },
        ],
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

// ── sale.void ─────────────────────────────────────────────────────────────────

describe("pos.sale.void", () => {
  function setupCompletedSale(movements: Array<{
    productId: string;
    quantity: number;
    fromWarehouseId: string | null;
  }> = []) {
    mockDb.pOSSale.findFirst.mockResolvedValue({
      id: SALE_ID,
      status: "completed",
    });
    mockDb.stockMovement.findMany.mockResolvedValue(movements);
    mockDb.stockMovement.create.mockResolvedValue({ id: "sm-rev" });
    mockDb.pOSSale.update.mockResolvedValue({ id: SALE_ID, status: "voided" });
    mockDb.$transaction.mockImplementation(async (fn: any) => fn(mockDb));
  }

  it("flips status from completed to voided (no movements)", async () => {
    setupCompletedSale([]);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.pos.sale.void({ id: SALE_ID, reason: "wrong item" });

    expect(result.status).toBe("voided");
    expect(mockDb.$transaction).toHaveBeenCalledTimes(1);
    expect(mockDb.stockMovement.create).not.toHaveBeenCalled();
    expect(mockDb.pOSSale.update).toHaveBeenCalledWith({
      where: { id: SALE_ID },
      data: { status: "voided" },
    });
  });

  it("reverses each original out-movement (out → in) inside the transaction", async () => {
    setupCompletedSale([
      { productId: PRODUCT_A, quantity: 2, fromWarehouseId: WAREHOUSE_ID },
      { productId: PRODUCT_B, quantity: 1, fromWarehouseId: WAREHOUSE_ID },
    ]);

    const caller = createCaller(authenticatedCtx());
    await caller.pos.sale.void({ id: SALE_ID, reason: "customer return" });

    expect(mockDb.stockMovement.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: "acme-tenant-id",
        referenceType: "pos_sale",
        referenceId: SALE_ID,
        type: "out",
      },
      select: {
        productId: true,
        quantity: true,
        fromWarehouseId: true,
      },
    });
    expect(mockDb.stockMovement.create).toHaveBeenCalledTimes(2);
    expect(mockDb.stockMovement.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        productId: PRODUCT_A,
        type: "in",
        quantity: 2,
        toWarehouseId: WAREHOUSE_ID,
        referenceType: "pos_sale_void",
        referenceId: SALE_ID,
        createdById: "user-1",
        notes: "customer return",
      }),
    });
    expect(mockDb.stockMovement.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({
        productId: PRODUCT_B,
        type: "in",
        quantity: 1,
        toWarehouseId: WAREHOUSE_ID,
      }),
    });
  });

  it("omits toWarehouseId on reversal when original fromWarehouseId is null", async () => {
    setupCompletedSale([
      { productId: PRODUCT_A, quantity: 1, fromWarehouseId: null },
    ]);

    const caller = createCaller(authenticatedCtx());
    await caller.pos.sale.void({ id: SALE_ID, reason: "x" });

    const call = mockDb.stockMovement.create.mock.calls[0][0];
    expect(call.data).not.toHaveProperty("toWarehouseId");
    expect(call.data.type).toBe("in");
  });

  it("rejects when sale is already voided", async () => {
    mockDb.pOSSale.findFirst.mockResolvedValue({
      id: SALE_ID,
      status: "voided",
    });
    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.pos.sale.void({ id: SALE_ID, reason: "x" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mockDb.stockMovement.findMany).not.toHaveBeenCalled();
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it("rejects when sale is refunded", async () => {
    mockDb.pOSSale.findFirst.mockResolvedValue({
      id: SALE_ID,
      status: "refunded",
    });
    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.pos.sale.void({ id: SALE_ID, reason: "x" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects when sale not found", async () => {
    mockDb.pOSSale.findFirst.mockResolvedValue(null);
    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.pos.sale.void({ id: SALE_ID, reason: "x" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects empty reason via Zod", async () => {
    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.pos.sale.void({ id: SALE_ID, reason: "" }),
    ).rejects.toBeInstanceOf(TRPCError);
  });

  it("blocks mutations on demo tenant", async () => {
    const caller = createCaller(authenticatedCtx(["Administrator"], true));
    await expect(
      caller.pos.sale.void({ id: SALE_ID, reason: "x" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
