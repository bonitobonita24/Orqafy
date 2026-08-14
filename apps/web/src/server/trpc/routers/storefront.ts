import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { Prisma } from "@prisma/client";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
  writeProcedure,
} from "../trpc";
import { matrixProcedure, matrixMiddleware } from "../middleware/matrix";
import { prisma as db, writeAuditLog } from "@orqafy/db";
import { createXenditInvoiceForOrder } from "@/lib/xendit-invoice";
import { sanitizePlainText } from "@/server/lib/sanitize";
import { rateLimiters } from "@/server/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";

async function loadOrderForTenant(id: string, ctx: { tenantId: string }) {
  const order = await db.ecommerceOrder.findUnique({ where: { id } });
  if (!order || order.tenantId !== ctx.tenantId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
  }
  return order;
}

// ── Public catalog read helpers (template-alignment T2.1) ───────────────────
// Shared by the admin-facing browseProducts/getProductById reads AND the new
// publicProcedure storefront queries below, so both surfaces return the same
// shape (brand/category relations + real WarehouseStock availability +
// derived discountPercent + Decimal→number price fields).

const PUBLIC_PRODUCT_INCLUDE = {
  brand: { select: { id: true, name: true, logoUrl: true } },
  category: { select: { id: true, name: true, slug: true, imageUrl: true } },
} satisfies Prisma.ProductInclude;

type PublicProduct = Prisma.ProductGetPayload<{ include: typeof PUBLIC_PRODUCT_INCLUDE }>;

// Real availability from WarehouseStock: sum(quantity) - sum(reservedQuantity)
// across every warehouse for the tenant, aggregated per productId.
async function loadAvailabilityMap(
  tenantId: string,
  productIds: string[],
): Promise<Map<string, number>> {
  if (productIds.length === 0) return new Map();
  const grouped = await db.warehouseStock.groupBy({
    by: ["productId"],
    where: { tenantId, productId: { in: productIds } },
    _sum: { quantity: true, reservedQuantity: true },
  });
  return new Map(
    grouped.map((g) => [
      g.productId,
      Number(g._sum.quantity ?? 0) - Number(g._sum.reservedQuantity ?? 0),
    ]),
  );
}

// Decimal→number conversion follows the existing display-price convention
// (apps/web/src/app/(tenant)/[slug]/store/products/page.tsx `displayPrice`):
// tier1Price wins when set and > 0, else baseCost. discountPercent is derived
// here, never stored, and only set when compareAtPrice genuinely undercuts price.
function mapPublicProduct(product: PublicProduct, availableQuantity: number) {
  const baseCost = Number(product.baseCost);
  const tier1Price = product.tier1Price === null ? null : Number(product.tier1Price);
  const price = tier1Price !== null && tier1Price > 0 ? tier1Price : baseCost;
  const compareAtPrice = product.compareAtPrice === null ? null : Number(product.compareAtPrice);
  const discountPercent =
    compareAtPrice !== null && compareAtPrice > price && price >= 0
      ? Math.round((1 - price / compareAtPrice) * 100)
      : null;

  return {
    ...product,
    baseCost,
    tier1Price,
    compareAtPrice,
    price,
    discountPercent,
    inStock: availableQuantity > 0,
    availableQuantity,
  };
}

async function requireActiveTenantBySlug(tenantSlug: string) {
  const tenant = await db.tenant.findUnique({ where: { slug: tenantSlug } });
  if (tenant === null || tenant.isActive === false) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found or inactive" });
  }
  return tenant;
}

async function loadProductForTenant(id: string, ctx: { tenantId: string }) {
  const product = await db.product.findFirst({
    where: { id, tenantId: ctx.tenantId },
    include: PUBLIC_PRODUCT_INCLUDE,
  });
  if (!product) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
  }
  return product;
}

// ── Constants ─────────────────────────────────────────────────────────────────

// Migrated to the data-driven `role_permissions` matrix (feature key
// "storefront"). Seed grants internalStaff {view:true, create:true,
// update:false} + Customer {view:true, create:true}. Reads and placeOrder
// stay broad (matches Customer's own grant); admin-only actions (order
// management, fulfillment, Xendit invoice creation) are gated on "update",
// which no non-bypass role is granted — resolving to bypass-only (Tenant
// Super Admin + Platform Owner). This replaces the old ADMIN_ROLES set,
// which listed the dead role name "Administrator" and so was effectively
// Platform-Owner-only; the matrix now correctly also admits Tenant Super
// Admin per the owner's RBAC ruling.
const storefrontViewProcedure = matrixProcedure("storefront", "view");
const storefrontCreateProcedure = writeProcedure.use(matrixMiddleware("storefront", "create"));
const storefrontManageReadProcedure = protectedProcedure.use(matrixMiddleware("storefront", "update"));
const storefrontManageProcedure = writeProcedure.use(matrixMiddleware("storefront", "update"));

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

const placeOrderInputSchema = z
  .object({
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
  })
  .strict();

const guestCustomerSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(200).optional(),
  phone: z.string().trim().max(50).optional(),
});

const placeOrderAsCustomerInputSchema = z
  .object({
    tenantSlug: z.string().trim().min(1).max(100),
    items: z.array(orderItemInputSchema).min(1),
    customer: guestCustomerSchema,
    shippingAddress: addressSchema,
    billingAddress: addressSchema,
    paymentMethod: z.enum(["cod", "bank_transfer", "xendit"]),
    notes: z.string().max(2000).optional(),
    cfTurnstileToken: z.string().min(1),
  })
  .strict();

// ── Public catalog read schemas (template-alignment T2.1) ───────────────────

const tenantSlugField = z.string().trim().min(1).max(100);

const listBrandsInputSchema = z.object({ tenantSlug: tenantSlugField }).strict();

const listMerchContentInputSchema = z
  .object({
    tenantSlug: tenantSlugField,
    kind: z.enum(["announcement", "hero", "promo"]).optional(),
  })
  .strict();

const getProductBySlugInputSchema = z
  .object({
    tenantSlug: tenantSlugField,
    slug: z.string().trim().min(1).max(200),
  })
  .strict();

const listFeaturedProductsInputSchema = z
  .object({
    tenantSlug: tenantSlugField,
    take: z.number().int().min(1).max(50).default(12),
  })
  .strict();

const listNewArrivalsInputSchema = z
  .object({
    tenantSlug: tenantSlugField,
    take: z.number().int().min(1).max(50).default(12),
  })
  .strict();

// ── Router ────────────────────────────────────────────────────────────────────

export const storefrontRouter = createTRPCRouter({
  browseProducts: storefrontViewProcedure
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
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = { isActive: input.isActive, tenantId: ctx.tenantId };
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
          include: PUBLIC_PRODUCT_INCLUDE,
          orderBy: { name: "asc" },
          skip: input.skip,
          take: input.take,
        }),
        db.product.count({ where }),
      ]);
      const availability = await loadAvailabilityMap(
        ctx.tenantId,
        items.map((p) => p.id),
      );
      return {
        items: items.map((p) => mapPublicProduct(p, availability.get(p.id) ?? 0)),
        total,
      };
    }),

  getProductById: storefrontViewProcedure
    .input(z.object({ id: cuid }))
    .query(async ({ ctx, input }) => {
      const product = await loadProductForTenant(input.id, ctx);
      const availability = await loadAvailabilityMap(ctx.tenantId, [product.id]);
      return mapPublicProduct(product, availability.get(product.id) ?? 0);
    }),

  placeOrder: storefrontCreateProcedure
    .input(placeOrderInputSchema)
    .mutation(async ({ ctx, input }) => {
      const customer = await db.customer.findUnique({
        where: { id: input.customerId },
      });
      if (
        customer === null ||
        customer.isActive === false ||
        customer.tenantId !== ctx.tenantId
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Customer not found or inactive",
        });
      }

      // M7.2 — defensive: explicitly confirm the user-supplied warehouseId belongs to
      // this tenant before it is written into stockMovement.fromWarehouseId /
      // warehouseStock lookups. Currently unreachable with a foreign warehouse (the
      // stock-availability check below would find no matching row and 0 out), but this
      // makes the tenant boundary explicit rather than relying on that side effect.
      const warehouse = await db.warehouse.findUnique({ where: { id: input.warehouseId } });
      if (!warehouse || warehouse.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Warehouse not found." });
      }

      const productIds = input.items.map((i) => i.productId);
      const products = await db.product.findMany({
        where: { id: { in: productIds }, isActive: true, tenantId: ctx.tenantId },
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
            tenantId: ctx.tenantId,
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
              tenantId: created.tenantId,
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
              tenantId: ctx.tenantId,
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

      const turnstileOk = await verifyTurnstile(input.cfTurnstileToken, ip);
      if (!turnstileOk) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid bot protection token.",
        });
      }

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
        where: { isDefault: true, isActive: true, tenantId: tenant.id },
      });
      if (warehouse === null) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "No default warehouse configured",
        });
      }

      const productIds = input.items.map((i) => i.productId);
      const products = await db.product.findMany({
        where: { id: { in: productIds }, isActive: true, tenantId: tenant.id },
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
              where: { email: input.customer.email, tenantId: tenant.id },
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
              tenantId: tenant.id,
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
            tenantId: tenant.id,
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
              tenantId: created.tenantId,
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
              tenantId: tenant.id,
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

        let invoiceUrl: string | undefined;
        if (input.paymentMethod === "xendit") {
          const xenditResult = await createXenditInvoiceForOrder({
            tenantId: tenant.id,
            orderId: created.id,
            orderNumber: created.orderNumber,
            totalAmount: Number(created.totalAmount),
            customerEmail: input.customer.email ?? null,
          });
          await tx.ecommerceOrder.update({
            where: { id: created.id },
            data: { xenditPaymentId: xenditResult.invoiceId },
          });
          invoiceUrl = xenditResult.invoiceUrl;
        }

        await writeAuditLog(tx, {
          userId: systemActor.id,
          action: "CREATE",
          entity: "EcommerceOrder",
          entityId: created.id,
          after: {
            orderNumber: created.orderNumber,
            totalAmount: Number(totalAmount),
            paymentMethod: input.paymentMethod,
            tenantId: tenant.id,
          },
          ipAddress: ip,
        });

        return { created, invoiceUrl };
      });

      return {
        orderId: result.created.id,
        orderNumber: result.created.orderNumber,
        ...(result.invoiceUrl !== undefined && { invoiceUrl: result.invoiceUrl }),
      };
    }),

  getOrderById: storefrontViewProcedure
    .input(z.object({ id: cuid }))
    .query(async ({ ctx, input }) => {
      const order = await db.ecommerceOrder.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId },
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

  listMyOrders: storefrontViewProcedure
    .input(
      z.object({
        customerId: cuid,
        status: z.enum(STATUS_VALUES).optional(),
        skip: z.number().int().min(0).default(0),
        take: z.number().int().min(1).max(100).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const customer = await db.customer.findFirst({
        where: { id: input.customerId, tenantId: ctx.tenantId },
        select: { id: true },
      });
      if (customer === null) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
      }
      const where: Record<string, unknown> = {
        customerId: input.customerId,
        tenantId: ctx.tenantId,
      };
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

  listAllOrders: storefrontManageReadProcedure
    .input(
      z
        .object({
          status: z.enum(STATUS_VALUES).optional(),
          paymentStatus: z
            .enum(["pending", "paid", "failed", "refunded"])
            .optional(),
          paymentMethod: z
            .enum(["cod", "bank_transfer", "xendit"])
            .optional(),
          customerId: cuid.optional(),
          skip: z.number().int().min(0).default(0),
          take: z.number().int().min(1).max(100).default(20),
        })
        .default({}),
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = { tenantId: ctx.tenantId };
      if (input.status !== undefined) where.status = input.status;
      if (input.paymentStatus !== undefined)
        where.paymentStatus = input.paymentStatus;
      if (input.paymentMethod !== undefined)
        where.paymentMethod = input.paymentMethod;
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

  // Guest order tracking — publicProcedure, rate-limited via rateLimiters.public.
  // Returns NOT_FOUND on any mismatch (tenant, orderNumber, or phone last-4) to
  // prevent enumeration. Matches the auth-gated-lookup posture from the xendit
  // webhook handler (lessons.md 2026-05-22 — return same error for unknown vs
  // wrong-auth to block resource enumeration).
  trackGuestOrder: publicProcedure
    .input(
      z.object({
        tenantSlug: z.string().trim().min(1).max(100),
        orderNumber: z.string().trim().min(1).max(50),
        phoneLast4: z.string().trim().regex(/^\d{4}$/),
      }),
    )
    .query(async ({ ctx, input }) => {
      const ipHeader = ctx.req.headers.get("x-forwarded-for") ?? ctx.req.headers.get("x-real-ip");
      const ip = ipHeader ?? "unknown";
      rateLimiters.public.check(ip);

      const tenant = await db.tenant.findUnique({
        where: { slug: input.tenantSlug },
      });
      if (tenant === null || tenant.isActive === false) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      }

      const order = await db.ecommerceOrder.findFirst({
        where: {
          orderNumber: input.orderNumber,
          tenantId: tenant.id,
          customer: { phone: { endsWith: input.phoneLast4 } },
        },
        select: {
          orderNumber: true,
          status: true,
          paymentStatus: true,
          trackingNumber: true,
          totalAmount: true,
          currency: true,
        },
      });

      if (order === null) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      }

      return order;
    }),

  createXenditInvoice: storefrontManageProcedure
    .input(z.object({ orderId: cuid }).strict())
    .mutation(async ({ ctx, input }) => {
      // Batch 21c: scope by ctx.tenantId so an admin cannot create an invoice
      // against another tenant's order even if they guess the cuid.
      const order = await db.ecommerceOrder.findFirst({
        where: { id: input.orderId, tenantId: ctx.tenantId },
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

      const { invoiceId, invoiceUrl } = await createXenditInvoiceForOrder({
        tenantId: ctx.tenantId,
        orderId: order.id,
        orderNumber: order.orderNumber,
        totalAmount: Number(order.totalAmount),
        customerEmail: order.customer.email,
      });
      await db.ecommerceOrder.update({
        where: { id: input.orderId },
        data: { xenditPaymentId: invoiceId },
      });

      return { invoiceUrl, invoiceId };
    }),

  updateFulfillment: storefrontManageProcedure
    .input(
      z
        .object({
          id: cuid,
          trackingNumber: z.string().trim().min(1).max(200).optional(),
          paymentMethod: z.string().trim().min(1).max(100).optional(),
        })
        .strict(),
    )
    .mutation(async ({ ctx, input }) => {
      await loadOrderForTenant(input.id, ctx);
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

  updateOrderStatus: storefrontManageProcedure
    .input(
      z
        .object({
          id: cuid,
          status: z.enum(STATUS_VALUES),
          notes: z.string().optional(),
        })
        .strict(),
    )
    .mutation(async ({ ctx, input }) => {
      const current = await loadOrderForTenant(input.id, ctx);
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
              tenantId: ctx.tenantId,
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

  // ── Public storefront catalog reads (template-alignment T2.1) ─────────────
  // publicProcedure, tenantSlug-scoped (no ctx.tenantId on the public path) —
  // mirrors placeOrderAsCustomer/trackGuestOrder: resolve+validate the tenant
  // by slug first, then rate-limit + scope every query to that tenant AND
  // ecommerceVisible products only.

  listBrands: publicProcedure
    .input(listBrandsInputSchema)
    .query(async ({ ctx, input }) => {
      const ipHeader = ctx.req.headers.get("x-forwarded-for") ?? ctx.req.headers.get("x-real-ip");
      const ip = ipHeader ?? "unknown";
      rateLimiters.public.check(ip);

      const tenant = await requireActiveTenantBySlug(input.tenantSlug);
      return db.brand.findMany({
        where: { tenantId: tenant.id, isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      });
    }),

  listMerchContent: publicProcedure
    .input(listMerchContentInputSchema)
    .query(async ({ ctx, input }) => {
      const ipHeader = ctx.req.headers.get("x-forwarded-for") ?? ctx.req.headers.get("x-real-ip");
      const ip = ipHeader ?? "unknown";
      rateLimiters.public.check(ip);

      const tenant = await requireActiveTenantBySlug(input.tenantSlug);
      const now = new Date();
      return db.merchContent.findMany({
        where: {
          tenantId: tenant.id,
          isActive: true,
          ...(input.kind !== undefined && { kind: input.kind }),
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
            { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
          ],
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      });
    }),

  getProductBySlug: publicProcedure
    .input(getProductBySlugInputSchema)
    .query(async ({ ctx, input }) => {
      const ipHeader = ctx.req.headers.get("x-forwarded-for") ?? ctx.req.headers.get("x-real-ip");
      const ip = ipHeader ?? "unknown";
      rateLimiters.public.check(ip);

      const tenant = await requireActiveTenantBySlug(input.tenantSlug);
      const baseWhere = { tenantId: tenant.id, isActive: true, ecommerceVisible: true };

      let product = await db.product.findFirst({
        where: { ...baseWhere, ecommerceSlug: input.slug },
        include: PUBLIC_PRODUCT_INCLUDE,
      });

      // Legacy URL fallback — some /store/products/[id] links predate the
      // ecommerceSlug field and still address the product by cuid. Only
      // attempted when the slug is cuid-shaped, to avoid a wasted lookup on
      // every genuine slug miss.
      if (product === null && cuid.safeParse(input.slug).success) {
        product = await db.product.findFirst({
          where: { ...baseWhere, id: input.slug },
          include: PUBLIC_PRODUCT_INCLUDE,
        });
      }

      if (product === null) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
      }

      const availability = await loadAvailabilityMap(tenant.id, [product.id]);
      return mapPublicProduct(product, availability.get(product.id) ?? 0);
    }),

  listFeaturedProducts: publicProcedure
    .input(listFeaturedProductsInputSchema)
    .query(async ({ ctx, input }) => {
      const ipHeader = ctx.req.headers.get("x-forwarded-for") ?? ctx.req.headers.get("x-real-ip");
      const ip = ipHeader ?? "unknown";
      rateLimiters.public.check(ip);

      const tenant = await requireActiveTenantBySlug(input.tenantSlug);
      const products = await db.product.findMany({
        where: {
          tenantId: tenant.id,
          isActive: true,
          ecommerceVisible: true,
          isFeatured: true,
        },
        include: PUBLIC_PRODUCT_INCLUDE,
        orderBy: { name: "asc" },
        take: input.take,
      });
      const availability = await loadAvailabilityMap(
        tenant.id,
        products.map((p) => p.id),
      );
      return products.map((p) => mapPublicProduct(p, availability.get(p.id) ?? 0));
    }),

  listNewArrivals: publicProcedure
    .input(listNewArrivalsInputSchema)
    .query(async ({ ctx, input }) => {
      const ipHeader = ctx.req.headers.get("x-forwarded-for") ?? ctx.req.headers.get("x-real-ip");
      const ip = ipHeader ?? "unknown";
      rateLimiters.public.check(ip);

      const tenant = await requireActiveTenantBySlug(input.tenantSlug);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const products = await db.product.findMany({
        where: {
          tenantId: tenant.id,
          isActive: true,
          ecommerceVisible: true,
          createdAt: { gte: thirtyDaysAgo },
        },
        include: PUBLIC_PRODUCT_INCLUDE,
        orderBy: { createdAt: "desc" },
        take: input.take,
      });
      const availability = await loadAvailabilityMap(
        tenant.id,
        products.map((p) => p.id),
      );
      return products.map((p) => mapPublicProduct(p, availability.get(p.id) ?? 0));
    }),
});
