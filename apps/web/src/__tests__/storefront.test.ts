/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/require-await */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { storefrontRouter } from "@/server/trpc/routers/storefront";
import { createTRPCRouter, createCallerFactory } from "@/server/trpc/trpc";
import { TRPCError } from "@trpc/server";

vi.mock("@orqafy/db", () => ({
  prisma: {
    product: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    ecommerceOrder: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    ecommerceOrderItem: {
      create: vi.fn(),
    },
    warehouseStock: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    stockMovement: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    customer: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    tenant: {
      findUnique: vi.fn(),
    },
    warehouse: {
      findFirst: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/server/lib/rate-limit", () => ({
  rateLimiters: {
    api: { check: vi.fn() },
    public: { check: vi.fn() },
  },
}));

vi.mock("@/lib/turnstile", () => ({
  verifyTurnstile: vi.fn().mockResolvedValue(true),
}));

const { mockCreateInvoice } = vi.hoisted(() => ({
  mockCreateInvoice: vi.fn(),
}));
// Batch 21c: getXenditClient is async + takes tenantId; getXenditWebhookToken is gone.
vi.mock("@/lib/xendit", () => ({
  getXenditClient: async (_tenantId: string): Promise<unknown> => ({
    Invoice: { createInvoice: mockCreateInvoice },
  }),
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
    userId: "ck1234567890123456789012a",
    roles,
    tenantSlug: "test-tenant",
    tenantId: "ck1234567890123456789012b",
    securityVersion: 0,
    isDemoTenant,
    session: null,
  };
}
function unauthenticatedCtx() {
  return {
    req: makeReq(),
    userId: null,
    roles: [] as string[],
    tenantSlug: null,
    tenantId: null,
    securityVersion: 0,
    isDemoTenant: false,
    session: null,
  };
}

const testRouter = createTRPCRouter({ storefront: storefrontRouter });
const createCaller = createCallerFactory(testRouter);

import { prisma as db } from "@orqafy/db";
const mockDb = db as unknown as {
  product: { findMany: any; findUnique: any; count: any };
  ecommerceOrder: {
    findFirst: any;
    findUnique: any;
    findMany: any;
    count: any;
    create: any;
    update: any;
  };
  ecommerceOrderItem: { create: any };
  warehouseStock: { findFirst: any; findUnique: any; findMany: any; update: any };
  stockMovement: { create: any; findMany: any };
  customer: { findUnique: any; findFirst: any; create: any };
  tenant: { findUnique: any };
  warehouse: { findFirst: any };
  user: { findFirst: any };
  $transaction: any;
};

const CUSTOMER_ID = "ck1234567890123456789012c";
const WAREHOUSE_ID = "ck1234567890123456789012d";
const PRODUCT_A = "ck1234567890123456789012e";
const PRODUCT_B = "ck1234567890123456789012f";
const ORDER_ID = "ck1234567890123456789012g";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("storefront router", () => {
  // ─── browseProducts ──────────────────────────────────────────────────────
  describe("browseProducts", () => {
    it("lists active products with default pagination", async () => {
      mockDb.product.findMany.mockResolvedValue([
        { id: PRODUCT_A, name: "Widget", isActive: true },
      ]);
      mockDb.product.count.mockResolvedValue(1);

      const caller = createCaller(authenticatedCtx());
      const res = await caller.storefront.browseProducts({});

      expect(res.items).toHaveLength(1);
      expect(res.total).toBe(1);
      const call = mockDb.product.findMany.mock.calls[0][0];
      expect(call.skip).toBe(0);
      expect(call.take).toBe(20);
    });

    it("filters by categoryId", async () => {
      mockDb.product.findMany.mockResolvedValue([]);
      mockDb.product.count.mockResolvedValue(0);

      const caller = createCaller(authenticatedCtx());
      await caller.storefront.browseProducts({ categoryId: "ck1234567890123456789012h" });

      const call = mockDb.product.findMany.mock.calls[0][0];
      expect(call.where.categoryId).toBe("ck1234567890123456789012h");
    });

    it("filters by search term across name and sku", async () => {
      mockDb.product.findMany.mockResolvedValue([]);
      mockDb.product.count.mockResolvedValue(0);

      const caller = createCaller(authenticatedCtx());
      await caller.storefront.browseProducts({ search: "widget" });

      const call = mockDb.product.findMany.mock.calls[0][0];
      expect(call.where.OR).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: expect.objectContaining({ contains: "widget" }) }),
          expect.objectContaining({ sku: expect.objectContaining({ contains: "widget" }) }),
        ]),
      );
    });

    it("respects custom take/skip pagination", async () => {
      mockDb.product.findMany.mockResolvedValue([]);
      mockDb.product.count.mockResolvedValue(0);

      const caller = createCaller(authenticatedCtx());
      await caller.storefront.browseProducts({ skip: 40, take: 5 });

      const call = mockDb.product.findMany.mock.calls[0][0];
      expect(call.skip).toBe(40);
      expect(call.take).toBe(5);
    });

    it("excludes inactive products by default", async () => {
      mockDb.product.findMany.mockResolvedValue([]);
      mockDb.product.count.mockResolvedValue(0);

      const caller = createCaller(authenticatedCtx());
      await caller.storefront.browseProducts({});

      const call = mockDb.product.findMany.mock.calls[0][0];
      expect(call.where.isActive).toBe(true);
    });
  });

  // ─── getProductById ──────────────────────────────────────────────────────
  describe("getProductById", () => {
    it("returns the product when found", async () => {
      mockDb.product.findUnique.mockResolvedValue({ id: PRODUCT_A, name: "Widget" });

      const caller = createCaller(authenticatedCtx());
      const res = await caller.storefront.getProductById({ id: PRODUCT_A });

      expect(res.id).toBe(PRODUCT_A);
    });

    it("throws NOT_FOUND when product missing", async () => {
      mockDb.product.findUnique.mockResolvedValue(null);

      const caller = createCaller(authenticatedCtx());
      await expect(
        caller.storefront.getProductById({ id: PRODUCT_A }),
      ).rejects.toThrow(TRPCError);
    });
  });

  // ─── placeOrder ──────────────────────────────────────────────────────────
  describe("placeOrder", () => {
    const validInput = {
      customerId: CUSTOMER_ID,
      warehouseId: WAREHOUSE_ID,
      items: [
        { productId: PRODUCT_A, quantity: 2, unitPrice: 100 },
        { productId: PRODUCT_B, quantity: 1, unitPrice: 50 },
      ],
    };

    function mockStockAvailable() {
      mockDb.customer.findUnique.mockResolvedValue({ id: CUSTOMER_ID, isActive: true });
      mockDb.product.findMany.mockResolvedValue([
        { id: PRODUCT_A, name: "A", isActive: true },
        { id: PRODUCT_B, name: "B", isActive: true },
      ]);
      mockDb.warehouseStock.findMany.mockResolvedValue([
        { productId: PRODUCT_A, warehouseId: WAREHOUSE_ID, quantity: 10, reservedQuantity: 0 },
        { productId: PRODUCT_B, warehouseId: WAREHOUSE_ID, quantity: 10, reservedQuantity: 0 },
      ]);
      mockDb.ecommerceOrder.findFirst.mockResolvedValue(null);
      mockDb.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          ecommerceOrder: {
            create: vi.fn().mockResolvedValue({
              id: ORDER_ID,
              orderNumber: "EC-2605-0001",
              customerId: CUSTOMER_ID,
              status: "pending",
              subtotal: 250,
              totalAmount: 250,
            }),
          },
          ecommerceOrderItem: { create: vi.fn() },
          warehouseStock: { update: vi.fn() },
          stockMovement: { create: vi.fn() },
        };
        return fn(tx);
      });
    }

    it("creates an order with server-computed subtotal and total", async () => {
      mockStockAvailable();

      const caller = createCaller(authenticatedCtx());
      const res = await caller.storefront.placeOrder(validInput);

      expect(res.id).toBe(ORDER_ID);
      expect(res.subtotal).toBe(250);
      expect(res.totalAmount).toBe(250);
    });

    it("generates orderNumber in EC-YYMM-NNNN format", async () => {
      mockStockAvailable();
      let createdOrderData: any = null;
      mockDb.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          ecommerceOrder: {
            create: vi.fn((args: any) => {
              createdOrderData = args.data;
              return Promise.resolve({
                id: ORDER_ID,
                ...args.data,
              });
            }),
          },
          ecommerceOrderItem: { create: vi.fn() },
          warehouseStock: { update: vi.fn() },
          stockMovement: { create: vi.fn() },
        };
        return fn(tx);
      });

      const caller = createCaller(authenticatedCtx());
      await caller.storefront.placeOrder(validInput);

      expect(createdOrderData.orderNumber).toMatch(/^EC-\d{4}-0001$/);
    });

    it("increments sequence when prior orders exist", async () => {
      mockStockAvailable();
      mockDb.ecommerceOrder.findFirst.mockResolvedValue({ orderNumber: "EC-2605-0042" });
      let createdOrderData: any = null;
      mockDb.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          ecommerceOrder: {
            create: vi.fn((args: any) => {
              createdOrderData = args.data;
              return Promise.resolve({ id: ORDER_ID, ...args.data });
            }),
          },
          ecommerceOrderItem: { create: vi.fn() },
          warehouseStock: { update: vi.fn() },
          stockMovement: { create: vi.fn() },
        };
        return fn(tx);
      });

      const caller = createCaller(authenticatedCtx());
      await caller.storefront.placeOrder(validInput);

      expect(createdOrderData.orderNumber).toMatch(/-0043$/);
    });

    it("rejects empty items array", async () => {
      mockStockAvailable();
      const caller = createCaller(authenticatedCtx());
      await expect(
        caller.storefront.placeOrder({ ...validInput, items: [] }),
      ).rejects.toThrow();
    });

    it("rejects when stock quantity insufficient", async () => {
      mockDb.customer.findUnique.mockResolvedValue({ id: CUSTOMER_ID, isActive: true });
      mockDb.product.findMany.mockResolvedValue([
        { id: PRODUCT_A, name: "A", isActive: true },
        { id: PRODUCT_B, name: "B", isActive: true },
      ]);
      mockDb.warehouseStock.findMany.mockResolvedValue([
        { productId: PRODUCT_A, warehouseId: WAREHOUSE_ID, quantity: 1, reservedQuantity: 0 },
        { productId: PRODUCT_B, warehouseId: WAREHOUSE_ID, quantity: 10, reservedQuantity: 0 },
      ]);

      const caller = createCaller(authenticatedCtx());
      await expect(caller.storefront.placeOrder(validInput)).rejects.toThrow(
        /insufficient stock/i,
      );
    });

    it("rejects when productId not found", async () => {
      mockDb.customer.findUnique.mockResolvedValue({ id: CUSTOMER_ID, isActive: true });
      mockDb.product.findMany.mockResolvedValue([
        { id: PRODUCT_A, name: "A", isActive: true },
        // PRODUCT_B missing
      ]);

      const caller = createCaller(authenticatedCtx());
      await expect(caller.storefront.placeOrder(validInput)).rejects.toThrow(
        /not found/i,
      );
    });

    it("rejects when customer not found or inactive", async () => {
      mockDb.customer.findUnique.mockResolvedValue(null);

      const caller = createCaller(authenticatedCtx());
      await expect(caller.storefront.placeOrder(validInput)).rejects.toThrow(
        /customer/i,
      );
    });

    it("decrements WarehouseStock.quantity for each item inside transaction", async () => {
      mockStockAvailable();
      const stockUpdates: any[] = [];
      mockDb.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          ecommerceOrder: {
            create: vi.fn().mockResolvedValue({
              id: ORDER_ID,
              orderNumber: "EC-2605-0001",
              subtotal: 250,
              totalAmount: 250,
            }),
          },
          ecommerceOrderItem: { create: vi.fn() },
          warehouseStock: {
            update: vi.fn((args: any) => {
              stockUpdates.push(args);
              return Promise.resolve({});
            }),
          },
          stockMovement: { create: vi.fn() },
        };
        return fn(tx);
      });

      const caller = createCaller(authenticatedCtx());
      await caller.storefront.placeOrder(validInput);

      expect(stockUpdates).toHaveLength(2);
      const decrements = stockUpdates.map((u) => u.data.quantity.decrement);
      expect(decrements).toEqual(expect.arrayContaining([2, 1]));
    });

    it("creates one StockMovement type='out' per item with EcommerceOrder reference", async () => {
      mockStockAvailable();
      const movements: any[] = [];
      mockDb.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          ecommerceOrder: {
            create: vi.fn().mockResolvedValue({
              id: ORDER_ID,
              orderNumber: "EC-2605-0001",
              subtotal: 250,
              totalAmount: 250,
            }),
          },
          ecommerceOrderItem: { create: vi.fn() },
          warehouseStock: { update: vi.fn() },
          stockMovement: {
            create: vi.fn((args: any) => {
              movements.push(args.data);
              return Promise.resolve({});
            }),
          },
        };
        return fn(tx);
      });

      const caller = createCaller(authenticatedCtx());
      await caller.storefront.placeOrder(validInput);

      expect(movements).toHaveLength(2);
      expect(movements[0].type).toBe("out");
      expect(movements[0].referenceType).toBe("EcommerceOrder");
      expect(movements[0].referenceId).toBe(ORDER_ID);
    });

    it("wraps all writes in db.$transaction (rollback on failure)", async () => {
      mockStockAvailable();
      mockDb.$transaction.mockRejectedValue(new Error("transaction failed"));

      const caller = createCaller(authenticatedCtx());
      await expect(caller.storefront.placeOrder(validInput)).rejects.toThrow(
        /transaction failed/,
      );
      expect(mockDb.$transaction).toHaveBeenCalled();
    });

    it("throws UNAUTHORIZED for unauthenticated caller", async () => {
      const caller = createCaller(unauthenticatedCtx());
      await expect(caller.storefront.placeOrder(validInput)).rejects.toThrow(
        TRPCError,
      );
    });
  });

  // ─── placeOrderAsCustomer (guest publicProcedure) ────────────────────────
  describe("placeOrderAsCustomer", () => {
    const TENANT_ID = "ck1234567890123456789012b";
    const NEW_CUSTOMER_ID = "ck1234567890123456789012h";
    const TENANT_SLUG = "test-tenant";

    const validGuestInput = {
      tenantSlug: TENANT_SLUG,
      items: [
        { productId: PRODUCT_A, quantity: 2, unitPrice: 100 },
        { productId: PRODUCT_B, quantity: 1, unitPrice: 50 },
      ],
      customer: {
        firstName: "Bob",
        lastName: "Smith",
        email: "bob@example.com",
        phone: "+639170000000",
      },
      shippingAddress: {
        line1: "123 Main St",
        city: "Manila",
        province: "Metro Manila",
        postalCode: "1000",
        country: "PH",
      },
      paymentMethod: "cod" as const,
      cfTurnstileToken: "test-turnstile-token",
    };

    function mockGuestHappyPath() {
      mockDb.tenant.findUnique.mockResolvedValue({
        id: TENANT_ID,
        slug: TENANT_SLUG,
        isActive: true,
      });
      mockDb.warehouse.findFirst.mockResolvedValue({
        id: WAREHOUSE_ID,
        isDefault: true,
        isActive: true,
      });
      mockDb.user.findFirst.mockResolvedValue({ id: "ck1234567890123456789012a" });
      mockDb.customer.findFirst.mockResolvedValue(null);
      mockDb.product.findMany.mockResolvedValue([
        { id: PRODUCT_A, name: "A", isActive: true },
        { id: PRODUCT_B, name: "B", isActive: true },
      ]);
      mockDb.warehouseStock.findMany.mockResolvedValue([
        { productId: PRODUCT_A, warehouseId: WAREHOUSE_ID, quantity: 10, reservedQuantity: 0 },
        { productId: PRODUCT_B, warehouseId: WAREHOUSE_ID, quantity: 10, reservedQuantity: 0 },
      ]);
      mockDb.ecommerceOrder.findFirst.mockResolvedValue(null);
      mockDb.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          customer: {
            create: vi.fn().mockResolvedValue({
              id: NEW_CUSTOMER_ID,
              firstName: "Bob",
              lastName: "Smith",
              email: "bob@example.com",
            }),
          },
          ecommerceOrder: {
            create: vi.fn().mockResolvedValue({
              id: ORDER_ID,
              orderNumber: "EC-2605-0001",
              customerId: NEW_CUSTOMER_ID,
              status: "pending",
              subtotal: 250,
              totalAmount: 250,
            }),
          },
          ecommerceOrderItem: { create: vi.fn() },
          warehouseStock: { update: vi.fn() },
          stockMovement: { create: vi.fn() },
        };
        return fn(tx);
      });
    }

    it("guest happy path: creates new customer + order, returns orderId+orderNumber", async () => {
      mockGuestHappyPath();

      const caller = createCaller(unauthenticatedCtx());
      const res = await caller.storefront.placeOrderAsCustomer(validGuestInput);

      expect(res.orderId).toBe(ORDER_ID);
      expect(res.orderNumber).toBe("EC-2605-0001");
    });

    it("rejects with BAD_REQUEST when verifyTurnstile returns false", async () => {
      const { verifyTurnstile } = await import("@/lib/turnstile");
      (verifyTurnstile as any).mockResolvedValueOnce(false);

      const caller = createCaller(unauthenticatedCtx());
      await expect(
        caller.storefront.placeOrderAsCustomer(validGuestInput),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("calls verifyTurnstile with the supplied token before any DB write", async () => {
      mockGuestHappyPath();
      const { verifyTurnstile } = await import("@/lib/turnstile");

      const caller = createCaller(unauthenticatedCtx());
      await caller.storefront.placeOrderAsCustomer(validGuestInput);

      expect(verifyTurnstile).toHaveBeenCalledWith(
        "test-turnstile-token",
        expect.any(String),
      );
    });

    it("reuses existing customer when email match found", async () => {
      mockGuestHappyPath();
      const existingId = "ck1234567890123456789012i";
      mockDb.customer.findFirst.mockResolvedValue({
        id: existingId,
        email: "bob@example.com",
        isActive: true,
      });
      let createdOrderData: any = null;
      let customerCreateCalls = 0;
      mockDb.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          customer: {
            create: vi.fn(() => {
              customerCreateCalls += 1;
              return Promise.resolve({ id: existingId });
            }),
          },
          ecommerceOrder: {
            create: vi.fn((args: any) => {
              createdOrderData = args.data;
              return Promise.resolve({
                id: ORDER_ID,
                orderNumber: "EC-2605-0001",
                ...args.data,
              });
            }),
          },
          ecommerceOrderItem: { create: vi.fn() },
          warehouseStock: { update: vi.fn() },
          stockMovement: { create: vi.fn() },
        };
        return fn(tx);
      });

      const caller = createCaller(unauthenticatedCtx());
      await caller.storefront.placeOrderAsCustomer(validGuestInput);

      expect(customerCreateCalls).toBe(0);
      expect(createdOrderData.customerId).toBe(existingId);
    });

    it("rejects empty items array", async () => {
      mockGuestHappyPath();
      const caller = createCaller(unauthenticatedCtx());
      await expect(
        caller.storefront.placeOrderAsCustomer({ ...validGuestInput, items: [] }),
      ).rejects.toThrow();
    });

    it("rejects when productId not found", async () => {
      mockGuestHappyPath();
      mockDb.product.findMany.mockResolvedValue([
        { id: PRODUCT_A, name: "A", isActive: true },
        // PRODUCT_B missing
      ]);

      const caller = createCaller(unauthenticatedCtx());
      await expect(
        caller.storefront.placeOrderAsCustomer(validGuestInput),
      ).rejects.toThrow(/not found/i);
    });

    it("rejects when stock insufficient", async () => {
      mockGuestHappyPath();
      mockDb.warehouseStock.findMany.mockResolvedValue([
        { productId: PRODUCT_A, warehouseId: WAREHOUSE_ID, quantity: 1, reservedQuantity: 0 },
        { productId: PRODUCT_B, warehouseId: WAREHOUSE_ID, quantity: 10, reservedQuantity: 0 },
      ]);

      const caller = createCaller(unauthenticatedCtx());
      await expect(
        caller.storefront.placeOrderAsCustomer(validGuestInput),
      ).rejects.toThrow(/insufficient stock/i);
    });

    it("sanitizes script tags from customer firstName before storing", async () => {
      mockGuestHappyPath();
      let createdCustomerData: any = null;
      mockDb.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          customer: {
            create: vi.fn((args: any) => {
              createdCustomerData = args.data;
              return Promise.resolve({ id: NEW_CUSTOMER_ID });
            }),
          },
          ecommerceOrder: {
            create: vi.fn().mockResolvedValue({
              id: ORDER_ID,
              orderNumber: "EC-2605-0001",
            }),
          },
          ecommerceOrderItem: { create: vi.fn() },
          warehouseStock: { update: vi.fn() },
          stockMovement: { create: vi.fn() },
        };
        return fn(tx);
      });

      const caller = createCaller(unauthenticatedCtx());
      await caller.storefront.placeOrderAsCustomer({
        ...validGuestInput,
        customer: {
          ...validGuestInput.customer,
          firstName: '<script>alert("xss")</script>Bob',
        },
      });

      expect(createdCustomerData.firstName).not.toContain("<script>");
    });

    it("rejects when tenantSlug does not resolve to an active tenant", async () => {
      mockDb.tenant.findUnique.mockResolvedValue(null);

      const caller = createCaller(unauthenticatedCtx());
      await expect(
        caller.storefront.placeOrderAsCustomer(validGuestInput),
      ).rejects.toThrow(/tenant/i);
    });

    // ─── Batch 20 — Xendit-for-guests refactor ───────────────────────────
    it("xendit happy path: creates invoice in transaction, persists xenditPaymentId, returns invoiceUrl", async () => {
      mockGuestHappyPath();
      mockCreateInvoice.mockResolvedValue({
        id: "xendit-guest-001",
        invoiceUrl: "https://checkout.xendit.co/web/xendit-guest-001",
      });
      let orderUpdateData: any = null;
      mockDb.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          customer: {
            create: vi.fn().mockResolvedValue({ id: NEW_CUSTOMER_ID }),
          },
          ecommerceOrder: {
            create: vi.fn().mockResolvedValue({
              id: ORDER_ID,
              orderNumber: "EC-2605-0001",
              totalAmount: 250,
            }),
            update: vi.fn((args: any) => {
              orderUpdateData = args.data;
              return Promise.resolve({});
            }),
          },
          ecommerceOrderItem: { create: vi.fn() },
          warehouseStock: { update: vi.fn() },
          stockMovement: { create: vi.fn() },
        };
        return fn(tx);
      });

      const caller = createCaller(unauthenticatedCtx());
      const res = await caller.storefront.placeOrderAsCustomer({
        ...validGuestInput,
        paymentMethod: "xendit",
      });

      expect(res.orderId).toBe(ORDER_ID);
      expect(res.orderNumber).toBe("EC-2605-0001");
      expect((res as any).invoiceUrl).toBe(
        "https://checkout.xendit.co/web/xendit-guest-001",
      );
      expect(orderUpdateData?.xenditPaymentId).toBe("xendit-guest-001");
    });

    it("xendit failure: transaction throws when Xendit invoice creation fails", async () => {
      mockGuestHappyPath();
      mockCreateInvoice.mockRejectedValue(
        new Error("Xendit-API-unreachable-marker"),
      );
      mockDb.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          customer: {
            create: vi.fn().mockResolvedValue({ id: NEW_CUSTOMER_ID }),
          },
          ecommerceOrder: {
            create: vi.fn().mockResolvedValue({
              id: ORDER_ID,
              orderNumber: "EC-2605-0001",
              totalAmount: 250,
            }),
            update: vi.fn(),
          },
          ecommerceOrderItem: { create: vi.fn() },
          warehouseStock: { update: vi.fn() },
          stockMovement: { create: vi.fn() },
        };
        return fn(tx);
      });

      const caller = createCaller(unauthenticatedCtx());
      // Assert the Xendit-side error surfaces (not a Zod enum rejection).
      // Pre-impl: Zod rejects "xendit" enum value → error mentions enum, NOT "unreachable-marker".
      // Post-impl: procedure runs → Xendit mock rejects → "unreachable-marker" surfaces.
      await expect(
        caller.storefront.placeOrderAsCustomer({
          ...validGuestInput,
          paymentMethod: "xendit",
        }),
      ).rejects.toThrow(/unreachable-marker/);
      // Xendit was actually attempted (proves procedure reached transaction body)
      expect(mockCreateInvoice).toHaveBeenCalled();
    });

    it("cod path returns no invoiceUrl and never invokes Xendit", async () => {
      mockGuestHappyPath();
      const caller = createCaller(unauthenticatedCtx());
      const res = await caller.storefront.placeOrderAsCustomer({
        ...validGuestInput,
        paymentMethod: "cod",
      });
      expect((res as any).invoiceUrl).toBeUndefined();
      expect(mockCreateInvoice).not.toHaveBeenCalled();
    });
  });

  // ─── getOrderById ────────────────────────────────────────────────────────
  describe("getOrderById", () => {
    it("returns order with items for admin", async () => {
      mockDb.ecommerceOrder.findUnique.mockResolvedValue({
        id: ORDER_ID,
        orderNumber: "EC-2605-0001",
        customerId: CUSTOMER_ID,
        items: [],
      });

      const caller = createCaller(authenticatedCtx());
      const res = await caller.storefront.getOrderById({ id: ORDER_ID });

      expect(res.id).toBe(ORDER_ID);
      const call = mockDb.ecommerceOrder.findUnique.mock.calls[0][0];
      expect(call.include.items).toBeTruthy();
    });

    it("throws NOT_FOUND when order missing", async () => {
      mockDb.ecommerceOrder.findUnique.mockResolvedValue(null);

      const caller = createCaller(authenticatedCtx());
      await expect(
        caller.storefront.getOrderById({ id: ORDER_ID }),
      ).rejects.toThrow(TRPCError);
    });
  });

  // ─── listAllOrders ───────────────────────────────────────────────────────
  describe("listAllOrders", () => {
    it("lists orders with pagination for admin", async () => {
      mockDb.ecommerceOrder.findMany.mockResolvedValue([]);
      mockDb.ecommerceOrder.count.mockResolvedValue(0);

      const caller = createCaller(authenticatedCtx());
      const res = await caller.storefront.listAllOrders({});

      expect(res.items).toBeDefined();
      expect(res.total).toBe(0);
    });

    it("filters by status", async () => {
      mockDb.ecommerceOrder.findMany.mockResolvedValue([]);
      mockDb.ecommerceOrder.count.mockResolvedValue(0);

      const caller = createCaller(authenticatedCtx());
      await caller.storefront.listAllOrders({ status: "pending" });

      const call = mockDb.ecommerceOrder.findMany.mock.calls[0][0];
      expect(call.where.status).toBe("pending");
    });

    it("requires admin role (FORBIDDEN for non-admin)", async () => {
      const caller = createCaller(authenticatedCtx(["Staff"]));
      await expect(caller.storefront.listAllOrders({})).rejects.toThrow(
        TRPCError,
      );
    });
  });

  // ─── updateOrderStatus ───────────────────────────────────────────────────
  describe("updateOrderStatus", () => {
    it("transitions pending → confirmed", async () => {
      mockDb.ecommerceOrder.findUnique.mockResolvedValue({
        id: ORDER_ID,
        status: "pending",
      });
      mockDb.ecommerceOrder.update.mockResolvedValue({
        id: ORDER_ID,
        status: "confirmed",
      });

      const caller = createCaller(authenticatedCtx());
      const res = await caller.storefront.updateOrderStatus({
        id: ORDER_ID,
        status: "confirmed",
      });

      expect(res.status).toBe("confirmed");
    });

    it("rejects invalid transition (delivered → pending)", async () => {
      mockDb.ecommerceOrder.findUnique.mockResolvedValue({
        id: ORDER_ID,
        status: "delivered",
      });

      const caller = createCaller(authenticatedCtx());
      await expect(
        caller.storefront.updateOrderStatus({ id: ORDER_ID, status: "pending" }),
      ).rejects.toThrow(/invalid transition/i);
    });

    it("requires admin role (FORBIDDEN for non-admin)", async () => {
      const caller = createCaller(authenticatedCtx(["Staff"]));
      await expect(
        caller.storefront.updateOrderStatus({
          id: ORDER_ID,
          status: "confirmed",
        }),
      ).rejects.toThrow(TRPCError);
    });

    // ─── Batch 15 Item 1: hold-release on cancellation ─────────────────────
    it("releases held stock on pending → cancelled (reversing StockMovement + WarehouseStock increment per item)", async () => {
      mockDb.ecommerceOrder.findUnique.mockResolvedValue({
        id: ORDER_ID,
        status: "pending",
      });
      mockDb.stockMovement.findMany.mockResolvedValue([
        { productId: PRODUCT_A, fromWarehouseId: WAREHOUSE_ID, quantity: 2 },
        { productId: PRODUCT_B, fromWarehouseId: WAREHOUSE_ID, quantity: 1 },
      ]);
      const stockUpdates: any[] = [];
      const movementCreates: any[] = [];
      mockDb.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          warehouseStock: {
            update: vi.fn((args: any) => {
              stockUpdates.push(args);
              return Promise.resolve({});
            }),
          },
          stockMovement: {
            create: vi.fn((args: any) => {
              movementCreates.push(args.data);
              return Promise.resolve({});
            }),
          },
          ecommerceOrder: {
            update: vi.fn().mockResolvedValue({ id: ORDER_ID, status: "cancelled" }),
          },
        };
        return fn(tx);
      });

      const caller = createCaller(authenticatedCtx());
      const res = await caller.storefront.updateOrderStatus({
        id: ORDER_ID,
        status: "cancelled",
      });

      expect(res.status).toBe("cancelled");
      expect(stockUpdates).toHaveLength(2);
      const increments = stockUpdates.map((u) => u.data.quantity.increment);
      expect(increments).toEqual(expect.arrayContaining([2, 1]));
      expect(movementCreates).toHaveLength(2);
      expect(movementCreates[0].type).toBe("in");
      expect(movementCreates[0].referenceType).toBe("EcommerceOrder");
      expect(movementCreates[0].referenceId).toBe(ORDER_ID);
      expect(movementCreates[0].notes).toMatch(/released on cancellation/i);
    });

    it("does NOT release stock on pending → confirmed (non-cancel transition stays simple update)", async () => {
      mockDb.ecommerceOrder.findUnique.mockResolvedValue({
        id: ORDER_ID,
        status: "pending",
      });
      mockDb.ecommerceOrder.update.mockResolvedValue({
        id: ORDER_ID,
        status: "confirmed",
      });

      const caller = createCaller(authenticatedCtx());
      await caller.storefront.updateOrderStatus({
        id: ORDER_ID,
        status: "confirmed",
      });

      expect(mockDb.stockMovement.findMany).not.toHaveBeenCalled();
      expect(mockDb.$transaction).not.toHaveBeenCalled();
    });

    it("releases held stock on confirmed → cancelled (proves disjunction in release gate)", async () => {
      mockDb.ecommerceOrder.findUnique.mockResolvedValue({
        id: ORDER_ID,
        status: "confirmed",
      });
      mockDb.stockMovement.findMany.mockResolvedValue([
        { productId: PRODUCT_A, fromWarehouseId: WAREHOUSE_ID, quantity: 5 },
      ]);
      const movementCreates: any[] = [];
      mockDb.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          warehouseStock: { update: vi.fn().mockResolvedValue({}) },
          stockMovement: {
            create: vi.fn((args: any) => {
              movementCreates.push(args.data);
              return Promise.resolve({});
            }),
          },
          ecommerceOrder: {
            update: vi.fn().mockResolvedValue({ id: ORDER_ID, status: "cancelled" }),
          },
        };
        return fn(tx);
      });

      const caller = createCaller(authenticatedCtx());
      const res = await caller.storefront.updateOrderStatus({
        id: ORDER_ID,
        status: "cancelled",
      });

      expect(res.status).toBe("cancelled");
      expect(movementCreates).toHaveLength(1);
      expect(movementCreates[0].type).toBe("in");
      expect(movementCreates[0].quantity).toBe(5);
    });
  });

  // ─── createXenditInvoice (Batch 17 Item 1) ───────────────────────────────
  describe("createXenditInvoice", () => {
    it("creates Xendit invoice and persists invoice id on pending order", async () => {
      // Batch 21c: createXenditInvoice now uses findFirst (tenantId-scoped).
      mockDb.ecommerceOrder.findFirst.mockResolvedValue({
        id: ORDER_ID,
        orderNumber: "EC-2605-0001",
        totalAmount: 1500,
        paymentStatus: "pending",
        xenditPaymentId: null,
        customer: { email: "buyer@example.com" },
      });
      mockDb.ecommerceOrder.update.mockResolvedValue({});
      mockCreateInvoice.mockResolvedValue({
        id: "xendit-inv-001",
        invoiceUrl: "https://checkout.xendit.co/web/xendit-inv-001",
      });

      const caller = createCaller(authenticatedCtx());
      const res = await caller.storefront.createXenditInvoice({
        orderId: ORDER_ID,
      });

      expect(res.invoiceUrl).toBe(
        "https://checkout.xendit.co/web/xendit-inv-001",
      );
      expect(res.invoiceId).toBe("xendit-inv-001");

      const createCall = (mockCreateInvoice.mock.calls[0] as any[])[0];
      expect(createCall.data.externalId).toBe(ORDER_ID);
      expect(createCall.data.amount).toBe(1500);
      expect(createCall.data.currency).toBe("PHP");
      expect(createCall.data.payerEmail).toBe("buyer@example.com");
      expect(createCall.data.description).toBe("Order EC-2605-0001");

      const updateCall = mockDb.ecommerceOrder.update.mock.calls[0][0];
      expect(updateCall.where.id).toBe(ORDER_ID);
      expect(updateCall.data.xenditPaymentId).toBe("xendit-inv-001");
    });

    it("omits payerEmail when customer has no email", async () => {
      mockDb.ecommerceOrder.findFirst.mockResolvedValue({
        id: ORDER_ID,
        orderNumber: "EC-2605-0002",
        totalAmount: 500,
        paymentStatus: "pending",
        xenditPaymentId: null,
        customer: { email: null },
      });
      mockDb.ecommerceOrder.update.mockResolvedValue({});
      mockCreateInvoice.mockResolvedValue({
        id: "xendit-inv-002",
        invoiceUrl: "https://checkout.xendit.co/web/xendit-inv-002",
      });

      const caller = createCaller(authenticatedCtx());
      await caller.storefront.createXenditInvoice({ orderId: ORDER_ID });

      const createCall = (mockCreateInvoice.mock.calls[0] as any[])[0];
      expect(createCall.data.payerEmail).toBeUndefined();
    });

    it("rejects when order paymentStatus is not pending", async () => {
      mockDb.ecommerceOrder.findFirst.mockResolvedValue({
        id: ORDER_ID,
        paymentStatus: "paid",
        xenditPaymentId: null,
        customer: { email: "buyer@example.com" },
      });

      const caller = createCaller(authenticatedCtx());
      await expect(
        caller.storefront.createXenditInvoice({ orderId: ORDER_ID }),
      ).rejects.toThrow(/cannot create invoice/i);
      expect(mockCreateInvoice).not.toHaveBeenCalled();
    });

    it("rejects when order already has a Xendit invoice", async () => {
      mockDb.ecommerceOrder.findFirst.mockResolvedValue({
        id: ORDER_ID,
        paymentStatus: "pending",
        xenditPaymentId: "xendit-existing-001",
        customer: { email: "buyer@example.com" },
      });

      const caller = createCaller(authenticatedCtx());
      await expect(
        caller.storefront.createXenditInvoice({ orderId: ORDER_ID }),
      ).rejects.toThrow(/already exists/i);
      expect(mockCreateInvoice).not.toHaveBeenCalled();
    });

    it("throws NOT_FOUND when order does not exist", async () => {
      mockDb.ecommerceOrder.findFirst.mockResolvedValue(null);

      const caller = createCaller(authenticatedCtx());
      await expect(
        caller.storefront.createXenditInvoice({ orderId: ORDER_ID }),
      ).rejects.toThrow(/not found/i);
      expect(mockCreateInvoice).not.toHaveBeenCalled();
    });
  });

  // ─── createXenditInvoiceForOrder helper (Batch 20 — extracted from createXenditInvoice) ──
  describe("createXenditInvoiceForOrder helper", () => {
    it("creates invoice via Xendit and returns {invoiceId, invoiceUrl}", async () => {
      mockCreateInvoice.mockResolvedValue({
        id: "helper-inv-001",
        invoiceUrl: "https://checkout.xendit.co/web/helper-inv-001",
      });
      const { createXenditInvoiceForOrder } = await import(
        "@/lib/xendit-invoice"
      );
      const res = await createXenditInvoiceForOrder({
        tenantId: "ck1234567890123456789012b",
        orderId: ORDER_ID,
        orderNumber: "EC-2605-0001",
        totalAmount: 1500,
        customerEmail: "buyer@example.com",
      });
      expect(res.invoiceId).toBe("helper-inv-001");
      expect(res.invoiceUrl).toBe(
        "https://checkout.xendit.co/web/helper-inv-001",
      );

      const callArgs = (mockCreateInvoice.mock.calls[0] as any[])[0];
      expect(callArgs.data.externalId).toBe(ORDER_ID);
      expect(callArgs.data.amount).toBe(1500);
      expect(callArgs.data.currency).toBe("PHP");
      expect(callArgs.data.payerEmail).toBe("buyer@example.com");
      expect(callArgs.data.description).toBe("Order EC-2605-0001");
    });

    it("throws when Xendit createInvoice rejects (caller responsible for transaction rollback)", async () => {
      mockCreateInvoice.mockRejectedValue(new Error("Xendit unreachable"));
      const { createXenditInvoiceForOrder } = await import(
        "@/lib/xendit-invoice"
      );
      await expect(
        createXenditInvoiceForOrder({
          tenantId: "ck1234567890123456789012b",
          orderId: ORDER_ID,
          orderNumber: "EC-2605-0001",
          totalAmount: 1500,
          customerEmail: "buyer@example.com",
        }),
      ).rejects.toThrow();
    });
  });

  // ─── updateFulfillment (Batch 16 Item 2) ─────────────────────────────────
  describe("updateFulfillment", () => {
    it("updates trackingNumber when provided", async () => {
      mockDb.ecommerceOrder.findUnique.mockResolvedValue({
        id: ORDER_ID,
        status: "processing",
      });
      mockDb.ecommerceOrder.update.mockResolvedValue({
        id: ORDER_ID,
        trackingNumber: "TRK-12345",
        paymentMethod: null,
      });

      const caller = createCaller(authenticatedCtx());
      const res = await caller.storefront.updateFulfillment({
        id: ORDER_ID,
        trackingNumber: "TRK-12345",
      });

      expect(res.trackingNumber).toBe("TRK-12345");
      const call = mockDb.ecommerceOrder.update.mock.calls[0][0];
      expect(call.where.id).toBe(ORDER_ID);
      expect(call.data.trackingNumber).toBe("TRK-12345");
      expect(call.data.paymentMethod).toBeUndefined();
    });

    it("updates paymentMethod when provided", async () => {
      mockDb.ecommerceOrder.findUnique.mockResolvedValue({
        id: ORDER_ID,
        status: "confirmed",
      });
      mockDb.ecommerceOrder.update.mockResolvedValue({
        id: ORDER_ID,
        trackingNumber: null,
        paymentMethod: "bank_transfer",
      });

      const caller = createCaller(authenticatedCtx());
      const res = await caller.storefront.updateFulfillment({
        id: ORDER_ID,
        paymentMethod: "bank_transfer",
      });

      expect(res.paymentMethod).toBe("bank_transfer");
      const call = mockDb.ecommerceOrder.update.mock.calls[0][0];
      expect(call.data.paymentMethod).toBe("bank_transfer");
      expect(call.data.trackingNumber).toBeUndefined();
    });

    it("updates both trackingNumber and paymentMethod when both provided", async () => {
      mockDb.ecommerceOrder.findUnique.mockResolvedValue({
        id: ORDER_ID,
        status: "processing",
      });
      mockDb.ecommerceOrder.update.mockResolvedValue({
        id: ORDER_ID,
        trackingNumber: "TRK-99",
        paymentMethod: "credit_card",
      });

      const caller = createCaller(authenticatedCtx());
      await caller.storefront.updateFulfillment({
        id: ORDER_ID,
        trackingNumber: "TRK-99",
        paymentMethod: "credit_card",
      });

      const call = mockDb.ecommerceOrder.update.mock.calls[0][0];
      expect(call.data.trackingNumber).toBe("TRK-99");
      expect(call.data.paymentMethod).toBe("credit_card");
    });

    it("requires admin role (FORBIDDEN for non-admin)", async () => {
      const caller = createCaller(authenticatedCtx(["Staff"]));
      await expect(
        caller.storefront.updateFulfillment({
          id: ORDER_ID,
          trackingNumber: "TRK-1",
        }),
      ).rejects.toThrow(TRPCError);
    });

    it("throws NOT_FOUND when order does not exist", async () => {
      mockDb.ecommerceOrder.findUnique.mockResolvedValue(null);

      const caller = createCaller(authenticatedCtx());
      await expect(
        caller.storefront.updateFulfillment({
          id: ORDER_ID,
          trackingNumber: "TRK-1",
        }),
      ).rejects.toThrow(/not found/i);
    });
  });
});
