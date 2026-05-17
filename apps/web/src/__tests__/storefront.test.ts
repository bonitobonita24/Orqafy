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
    },
    customer: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

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
  stockMovement: { create: any };
  customer: { findUnique: any };
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
  });
});
