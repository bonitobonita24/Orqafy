import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { Prisma } from "@prisma/client";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
  writeProcedure,
} from "../trpc";
import { prisma as db } from "@orqafy/db";
import { getXenditClient } from "@/lib/xendit";
import { sanitizePlainText } from "@/server/lib/sanitize";
import { rateLimiters } from "@/server/lib/rate-limit";

// ── Constants ─────────────────────────────────────────────────────────────────

const ADMIN_ROLES = new Set(["Administrator", "Platform Owner"]);

const STATUS_VALUES = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
] as const;
type OrderStatus = (typeof STATUS_VALUES)[number];

const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: ["refunded"],
  cancelled: [],
  refunded: [],
};

// ── Sequence helper ───────────────────────────────────────────────────────────

async function generateOrderNumber(): Promise<string> {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `EC-${yy}${mm}-`;
  const last = await db.ecommerceOrder.findFirst({
    where: { orderNumber: { startsWith: prefix } },
    orderBy: { orderNumber: "desc" },
    select: { orderNumber: true },
  });
  const seq = last
    ? parseInt(last.orderNumber.slice(prefix.length), 10) + 1
    : 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

// ── Zod schemas ───────────────────────────────────────────────────────────────

const cuid = z.string().cuid();

const orderItemInputSchema = z.object({
  productId: cuid,
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
});

const addressSchema = z
  .object({
    line1: z.string().optional(),
    line2: z.string().optional(),
    city: z.string().optional(),
    province: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().optional(),
  })
  .passthrough()
  .optional();

const placeOrderInputSchema = z.object({
  customerId: cuid,
  warehouseId: cuid,
  items: z.array(orderItemInputSchema).min(1),
  shippingAddress: addressSchema,
  billingAddress: addressSchema,
  paymentMethod: z.string().optional(),
  notes: z.string().optional(),
  taxAmount: z.number().nonnegative().default(0),
  shippingAmount: z.number().nonnegative().default(0),
  discountAmount: z.number().nonnegative().default(0),
});

const guestCustomerSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(200).optional(),
  phone: z.string().trim().max(50).optional(),
});

const placeOrderAsCustomerInputSchema = z.object({
  tenantSlug: z.string().trim().min(1).max(100),
  items: z.array(orderItemInputSchema).min(1),
  customer: guestCustomerSchema,
  shippingAddress: addressSchema,
  billingAddress: addressSchema,
  paymentMethod: z.enum(["cod", "bank_transfer"]),
  notes: z.string().max(2000).optional(),
});

function requireAdmin(roles: readonly string[]): void {
  if (!roles.some((r) => ADMIN_ROLES.has(r))) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
}

// ── Router ────────────────────────────────────────────────────────────────────

export const storefrontRouter = createTRPCRouter({
  browseProducts: protectedProcedure
    .input(
      z
        .object({
          categoryId: cuid.optional(),
          search: z.string().trim().min(1).optional(),
          isActive: z.boolean().default(true),
          skip: z.number().int().min(0).default(0),
          take: z.number().int().min(1).max(100).default(20),
        })
        .default({}),
    )
    .query(async ({ input }) => {
      const where: Record<string, unknown> = { isActive: input.isActive };
      if (input.categoryId !== undefined) where.categoryId = input.categoryId;
      if (input.search !== undefined) {
        where.OR = [
          { name: { contains: input.search, mode: "insensitive" } },
          { sku: { contains: input.search, mode: "insensitive" } },
        ];
      }
      const [items, total] = await Promise.all([
        db.product.findMany({
          where,
          orderBy: { name: "asc" },
          skip: input.skip,
          take: input.take,
        }),
        db.product.count({ where }),
      ]);
      return { items, total };
    }),

  getProductById: protectedProcedure
    .input(z.object({ id: cuid }))
    .query(async ({ input }) => {
      const product = await db.product.findUnique({ where: { id: input.id } });
      if (product === null) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
      }
      return product;
    }),

  placeOrder: writeProcedure
    .input(placeOrderInputSchema)
    .mutation(async ({ ctx, input }) => {
      const customer = await db.customer.findUnique({
        where: { id: input.customerId },
      });
      if (customer === null || customer.isActive === false) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Customer not found or inactive",
        });
      }

      const productIds = input.items.map((i) => i.productId);
      const products = await db.product.findMany({
        where: { id: { in: productIds }, isActive: true },
        select: { id: true, name: true },
      });
      if (products.length !== productIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "One or more products not found or inactive",
        });
      }

      const stocks = await db.warehouseStock.findMany({
        where: {
          warehouseId: input.warehouseId,
          productId: { in: productIds },
        },
      });
      const stockByProduct = new Map(
        stocks.map((s) => [s.productId, Number(s.quantity) - Number(s.reservedQuantity ?? 0)]),
      );
      for (const item of input.items) {
        const available = stockByProduct.get(item.productId) ?? 0;
        if (available < item.quantity) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Insufficient stock for product ${item.productId}`,
          });
        }
      }

      const subtotal = input.items.reduce(
        (sum, i) => sum + i.quantity * i.unitPrice,
        0,
      );
      const totalAmount =
        subtotal + input.taxAmount + input.shippingAmount - input.discountAmount;

      const productNameById = new Map(products.map((p) => [p.id, p.name]));
      const orderNumber = await generateOrderNumber();

      const order = await db.$transaction(async (tx) => {
        const created = await tx.ecommerceOrder.create({
          data: {
            orderNumber,
            customerId: input.customerId,
            status: "pending",
            subtotal,
            taxAmount: input.taxAmount,
            shippingAmount: input.shippingAmount,
            discountAmount: input.discountAmount,
            totalAmount,
            paymentMethod: input.paymentMethod ?? null,
            paymentStatus: "pending",
            ...(input.shippingAddress !== undefined && {
              shippingAddress: input.shippingAddress as Prisma.InputJsonValue,
            }),
            ...(input.billingAddress !== undefined && {
              billingAddress: input.billingAddress as Prisma.InputJsonValue,
            }),
            notes: input.notes ?? null,
          },
        });

        for (const item of input.items) {
          await tx.ecommerceOrderItem.create({
            data: {
              orderId: created.id,
              productId: item.productId,
              description: productNameById.get(item.productId) ?? "",
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.quantity * item.unitPrice,
            },
          });

          await tx.warehouseStock.update({
            where: {
              warehouseId_productId: {
                warehouseId: input.warehouseId,
                productId: item.productId,
              },
            },
            data: {
              quantity: { decrement: item.quantity },
            },
          });

          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              type: "out",
              quantity: item.quantity,
              fromWarehouseId: input.warehouseId,
              referenceType: "EcommerceOrder",
              referenceId: created.id,
              notes: `Order ${orderNumber}`,
              createdById: ctx.userId,
            },
          });
        }

        return created;
      });

      return order;
    }),

  // Guest checkout — first publicProcedure on storefront router (Batch 18 Item 2).
  // Customers without accounts can place orders. Rate-limited via rateLimiters.public.
  // No Xendit invoice creation in this batch — paymentStatus stays "pending" for manual settlement.
  placeOrderAsCustomer: publicProcedure
    .input(placeOrderAsCustomerInputSchema)
    .mutation(async ({ ctx, input }) => {
      const ipHeader = ctx.req.headers.get("x-forwarded-for") ?? ctx.req.headers.get("x-real-ip");
      const ip = ipHeader ?? "unknown";
      rateLimiters.public.check(ip);

      const tenant = await db.tenant.findUnique({
        where: { slug: input.tenantSlug },
      });
      if (tenant === null || tenant.isActive === false) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Tenant not found or inactive",
        });
      }

      const warehouse = await db.warehouse.findFirst({
        where: { isDefault: true, isActive: true },
      });
      if (warehouse === null) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "No default warehouse configured",
        });
      }

      const productIds = input.items.map((i) => i.productId);
      const products = await db.product.findMany({
        where: { id: { in: productIds }, isActive: true },
        select: { id: true, name: true },
      });
      if (products.length !== productIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "One or more products not found or inactive",
        });
      }

      const stocks = await db.warehouseStock.findMany({
        where: {
          warehouseId: warehouse.id,
          productId: { in: productIds },
        },
      });
      const stockByProduct = new Map(
        stocks.map((s) => [s.productId, Number(s.quantity) - Number(s.reservedQuantity ?? 0)]),
      );
      for (const item of input.items) {
        const available = stockByProduct.get(item.productId) ?? 0;
        if (available < item.quantity) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Insufficient stock for product ${item.productId}`,
          });
        }
      }

      // Resolve a system actor for StockMovement.createdById (required, non-nullable).
      // Guest checkout has no ctx.userId — attribute stock movements to the first active user.
      const systemActor = await db.user.findFirst({
        where: { isActive: true },
        select: { id: true },
        orderBy: { createdAt: "asc" },
      });
      if (systemActor === null) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "No system actor available to record stock movement",
        });
      }

      const subtotal = input.items.reduce(
        (sum, i) => sum + i.quantity * i.unitPrice,
        0,
      );
      const totalAmount = subtotal;

      const firstName = sanitizePlainText(input.customer.firstName);
      const lastName = sanitizePlainText(input.customer.lastName);
      const sanitizedNotes =
        input.notes !== undefined ? sanitizePlainText(input.notes) : null;

      const existingCustomer =
        input.customer.email !== undefined
          ? await db.customer.findFirst({
              where: { email: input.customer.email },
            })
          : null;

      const productNameById = new Map(products.map((p) => [p.id, p.name]));
      const orderNumber = await generateOrderNumber();

      const result = await db.$transaction(async (tx) => {
        let customerId: string;
        if (existingCustomer !== null) {
          customerId = existingCustomer.id;
        } else {
          const newCustomer = await tx.customer.create({
            data: {
              firstName,
              lastName,
              email: input.customer.email ?? null,
              phone: input.customer.phone ?? null,
              country: "PH",
            },
          });
          customerId = newCustomer.id;
        }

        const created = await tx.ecommerceOrder.create({
          data: {
            orderNumber,
            customerId,
            status: "pending",
            subtotal,
            taxAmount: 0,
            shippingAmount: 0,
            discountAmount: 0,
            totalAmount,
            paymentMethod: input.paymentMethod,
            paymentStatus: "pending",
            ...(input.shippingAddress !== undefined && {
              shippingAddress: input.shippingAddress as Prisma.InputJsonValue,
            }),
            ...(input.billingAddress !== undefined && {
              billingAddress: input.billingAddress as Prisma.InputJsonValue,
            }),
            notes: sanitizedNotes,
          },
        });

        for (const item of input.items) {
          await tx.ecommerceOrderItem.create({
            data: {
              orderId: created.id,
              productId: item.productId,
              description: productNameById.get(item.productId) ?? "",
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.quantity * item.unitPrice,
            },
          });

          await tx.warehouseStock.update({
            where: {
              warehouseId_productId: {
                warehouseId: warehouse.id,
                productId: item.productId,
              },
            },
            data: {
              quantity: { decrement: item.quantity },
            },
          });

          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              type: "out",
              quantity: item.quantity,
              fromWarehouseId: warehouse.id,
              referenceType: "EcommerceOrder",
              referenceId: created.id,
              notes: `Guest order ${orderNumber}`,
              createdById: systemActor.id,
            },
          });
        }

        return created;
      });

      return { orderId: result.id, orderNumber: result.orderNumber };
    }),

  getOrderById: protectedProcedure
    .input(z.object({ id: cuid }))
    .query(async ({ input }) => {
      const order = await db.ecommerceOrder.findUnique({
        where: { id: input.id },
        include: {
          items: { include: { product: { select: { id: true, name: true, sku: true } } } },
          customer: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });
      if (order === null) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      }
      return order;
    }),

  listMyOrders: protectedProcedure
    .input(
      z.object({
        customerId: cuid,
        status: z.enum(STATUS_VALUES).optional(),
        skip: z.number().int().min(0).default(0),
        take: z.number().int().min(1).max(100).default(20),
      }),
    )
    .query(async ({ input }) => {
      const where: Record<string, unknown> = { customerId: input.customerId };
      if (input.status !== undefined) where.status = input.status;
      const [items, total] = await Promise.all([
        db.ecommerceOrder.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: input.skip,
          take: input.take,
        }),
        db.ecommerceOrder.count({ where }),
      ]);
      return { items, total };
    }),

  listAllOrders: protectedProcedure
    .input(
      z
        .object({
          status: z.enum(STATUS_VALUES).optional(),
          customerId: cuid.optional(),
          skip: z.number().int().min(0).default(0),
          take: z.number().int().min(1).max(100).default(20),
        })
        .default({}),
    )
    .query(async ({ ctx, input }) => {
      requireAdmin(ctx.roles);
      const where: Record<string, unknown> = {};
      if (input.status !== undefined) where.status = input.status;
      if (input.customerId !== undefined) where.customerId = input.customerId;
      const [items, total] = await Promise.all([
        db.ecommerceOrder.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: input.skip,
          take: input.take,
          include: {
            customer: { select: { id: true, firstName: true, lastName: true } },
          },
        }),
        db.ecommerceOrder.count({ where }),
      ]);
      return { items, total };
    }),

  createXenditInvoice: writeProcedure
    .input(z.object({ orderId: cuid }))
    .mutation(async ({ input }) => {
      const order = await db.ecommerceOrder.findUnique({
        where: { id: input.orderId },
        include: {
          customer: { select: { email: true } },
        },
      });
      if (order === null) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      }
      if (order.paymentStatus !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Order payment status is ${order.paymentStatus} — cannot create invoice`,
        });
      }
      if (order.xenditPaymentId !== null) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invoice already exists for this order",
        });
      }

      const xendit = getXenditClient();
      const customerEmail = order.customer.email;
      const invoice = await xendit.Invoice.createInvoice({
        data: {
          externalId: order.id,
          amount: Number(order.totalAmount),
          description: `Order ${order.orderNumber}`,
          currency: "PHP",
          ...(customerEmail !== null &&
            customerEmail !== "" && { payerEmail: customerEmail }),
        },
      });

      const invoiceId = invoice.id ?? null;
      await db.ecommerceOrder.update({
        where: { id: input.orderId },
        data: { xenditPaymentId: invoiceId },
      });

      return { invoiceUrl: invoice.invoiceUrl, invoiceId };
    }),

  updateFulfillment: writeProcedure
    .input(
      z.object({
        id: cuid,
        trackingNumber: z.string().trim().min(1).max(200).optional(),
        paymentMethod: z.string().trim().min(1).max(100).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx.roles);
      const current = await db.ecommerceOrder.findUnique({
        where: { id: input.id },
        select: { id: true },
      });
      if (current === null) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      }
      return db.ecommerceOrder.update({
        where: { id: input.id },
        data: {
          ...(input.trackingNumber !== undefined && {
            trackingNumber: input.trackingNumber,
          }),
          ...(input.paymentMethod !== undefined && {
            paymentMethod: input.paymentMethod,
          }),
        },
      });
    }),

  updateOrderStatus: writeProcedure
    .input(
      z.object({
        id: cuid,
        status: z.enum(STATUS_VALUES),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx.roles);
      const current = await db.ecommerceOrder.findUnique({
        where: { id: input.id },
        select: { status: true },
      });
      if (current === null) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      }
      const allowed = STATUS_TRANSITIONS[current.status as OrderStatus] ?? [];
      if (!allowed.includes(input.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Invalid transition: ${current.status} → ${input.status}`,
        });
      }

      const isReleasingHold =
        input.status === "cancelled" &&
        (current.status === "pending" ||
          current.status === "confirmed" ||
          current.status === "processing");

      if (!isReleasingHold) {
        return db.ecommerceOrder.update({
          where: { id: input.id },
          data: {
            status: input.status,
            ...(input.notes !== undefined && { notes: input.notes }),
          },
        });
      }

      const outMovements = await db.stockMovement.findMany({
        where: {
          referenceType: "EcommerceOrder",
          referenceId: input.id,
          type: "out",
        },
        select: { productId: true, fromWarehouseId: true, quantity: true },
      });

      return db.$transaction(async (tx) => {
        for (const m of outMovements) {
          if (m.fromWarehouseId === null) continue;
          await tx.warehouseStock.update({
            where: {
              warehouseId_productId: {
                warehouseId: m.fromWarehouseId,
                productId: m.productId,
              },
            },
            data: { quantity: { increment: m.quantity } },
          });
          await tx.stockMovement.create({
            data: {
              productId: m.productId,
              type: "in",
              quantity: m.quantity,
              toWarehouseId: m.fromWarehouseId,
              referenceType: "EcommerceOrder",
              referenceId: input.id,
              notes: "Stock released on cancellation",
              createdById: ctx.userId,
            },
          });
        }
        return tx.ecommerceOrder.update({
          where: { id: input.id },
          data: {
            status: input.status,
            ...(input.notes !== undefined && { notes: input.notes }),
          },
        });
      });
    }),
});
