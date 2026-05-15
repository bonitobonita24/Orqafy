import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, writeProcedure } from "../trpc";
import { prisma as db } from "@orqafy/db";

// ── Sequence helpers ──────────────────────────────────────────────────────────

async function generateSessionNumber(): Promise<string> {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `POS-${yy}${mm}-`;
  const last = await db.pOSSession.findFirst({
    where: { sessionNumber: { startsWith: prefix } },
    orderBy: { sessionNumber: "desc" },
    select: { sessionNumber: true },
  });
  const seq = last
    ? parseInt(last.sessionNumber.slice(prefix.length), 10) + 1
    : 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

async function generateSaleNumber(): Promise<string> {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `SALE-${yy}${mm}-`;
  const last = await db.pOSSale.findFirst({
    where: { saleNumber: { startsWith: prefix } },
    orderBy: { saleNumber: "desc" },
    select: { saleNumber: true },
  });
  const seq = last
    ? parseInt(last.saleNumber.slice(prefix.length), 10) + 1
    : 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

// ── Zod schemas ───────────────────────────────────────────────────────────────

const cuid = z.string().cuid();

const paymentMethodSchema = z.enum(["cash", "gcash", "maya", "card", "credit"]);

const saleItemInputSchema = z.object({
  productId: cuid,
  description: z.string().trim().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
});

// ── Session sub-router ────────────────────────────────────────────────────────

const sessionRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z
        .object({
          status: z.enum(["open", "closed"]).optional(),
          userId: cuid.optional(),
          skip: z.number().int().min(0).default(0),
          take: z.number().int().min(1).max(100).default(20),
        })
        .default({}),
    )
    .query(async ({ input }) => {
      const where = {
        ...(input.status !== undefined && { status: input.status }),
        ...(input.userId !== undefined && { userId: input.userId }),
      };
      const [items, total] = await Promise.all([
        db.pOSSession.findMany({
          where,
          orderBy: { openedAt: "desc" },
          skip: input.skip,
          take: input.take,
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, displayName: true },
            },
            _count: { select: { sales: true } },
          },
        }),
        db.pOSSession.count({ where }),
      ]);
      return { items, total };
    }),

  byId: protectedProcedure.input(z.object({ id: cuid })).query(async ({ input }) => {
    const session = await db.pOSSession.findUnique({
      where: { id: input.id },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, displayName: true },
        },
        sales: {
          orderBy: { createdAt: "desc" },
          include: { _count: { select: { items: true } } },
        },
      },
    });
    if (session === null) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Session not found." });
    }
    return session;
  }),

  open: writeProcedure
    .input(z.object({ openingBalance: z.number().nonnegative(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.userId === null) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }
      const existing = await db.pOSSession.findFirst({
        where: { userId: ctx.userId, status: "open" },
        select: { id: true, sessionNumber: true },
      });
      if (existing !== null) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `You already have an open session: ${existing.sessionNumber}.`,
        });
      }
      const sessionNumber = await generateSessionNumber();
      return db.pOSSession.create({
        data: {
          sessionNumber,
          userId: ctx.userId,
          openingBalance: input.openingBalance,
          status: "open",
          ...(input.notes !== undefined && { notes: input.notes }),
        },
      });
    }),

  close: writeProcedure
    .input(
      z.object({
        id: cuid,
        closingBalance: z.number().nonnegative(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const session = await db.pOSSession.findUnique({
        where: { id: input.id },
        select: { id: true, openingBalance: true, status: true },
      });
      if (session === null) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found." });
      }
      if (session.status !== "open") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Session is not open.",
        });
      }

      // Sum completed cash sales for expectedBalance calc.
      const cashAgg = await db.pOSSale.aggregate({
        where: { sessionId: input.id, status: "completed", paymentMethod: "cash" },
        _sum: { totalAmount: true },
      });
      const totalCashSales = Number(cashAgg._sum.totalAmount ?? 0);
      const expectedBalance = Number(session.openingBalance) + totalCashSales;
      const discrepancy = input.closingBalance - expectedBalance;

      return db.pOSSession.update({
        where: { id: input.id },
        data: {
          status: "closed",
          closedAt: new Date(),
          closingBalance: input.closingBalance,
          expectedBalance,
          discrepancy,
          ...(input.notes !== undefined && { notes: input.notes }),
        },
      });
    }),
});

// ── Sale sub-router ───────────────────────────────────────────────────────────

const saleRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z
        .object({
          sessionId: cuid.optional(),
          status: z.enum(["completed", "voided", "refunded"]).optional(),
          paymentMethod: paymentMethodSchema.optional(),
          skip: z.number().int().min(0).default(0),
          take: z.number().int().min(1).max(100).default(20),
        })
        .default({}),
    )
    .query(async ({ input }) => {
      const where = {
        ...(input.sessionId !== undefined && { sessionId: input.sessionId }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.paymentMethod !== undefined && { paymentMethod: input.paymentMethod }),
      };
      const [items, total] = await Promise.all([
        db.pOSSale.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: input.skip,
          take: input.take,
          include: { _count: { select: { items: true } } },
        }),
        db.pOSSale.count({ where }),
      ]);
      return { items, total };
    }),

  byId: protectedProcedure.input(z.object({ id: cuid })).query(async ({ input }) => {
    const sale = await db.pOSSale.findUnique({
      where: { id: input.id },
      include: {
        items: { orderBy: { createdAt: "asc" } },
        session: { select: { id: true, sessionNumber: true, status: true } },
      },
    });
    if (sale === null) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Sale not found." });
    }
    return sale;
  }),

  create: writeProcedure
    .input(
      z.object({
        sessionId: cuid,
        warehouseId: cuid,
        customerId: cuid.optional(),
        items: z.array(saleItemInputSchema).min(1),
        taxAmount: z.number().nonnegative().default(0),
        discountAmount: z.number().nonnegative().default(0),
        amountPaid: z.number().nonnegative(),
        paymentMethod: paymentMethodSchema,
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.userId === null) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const session = await db.pOSSession.findUnique({
        where: { id: input.sessionId },
        select: { id: true, status: true },
      });
      if (session === null) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found." });
      }
      if (session.status !== "open") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot record a sale on a closed session.",
        });
      }

      // Validate every product exists.
      const productIds = input.items.map((i) => i.productId);
      const products = await db.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true },
      });
      if (products.length !== new Set(productIds).size) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "One or more products do not exist.",
        });
      }

      const subtotal = input.items.reduce(
        (sum, i) => sum + i.quantity * i.unitPrice,
        0,
      );
      const totalAmount = subtotal + input.taxAmount - input.discountAmount;

      if (totalAmount < 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Discount cannot exceed subtotal + tax.",
        });
      }
      if (input.amountPaid < totalAmount) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Amount paid is less than the total due.",
        });
      }

      // Cash sales return change; non-cash methods must pay exact total.
      const changeAmount =
        input.paymentMethod === "cash" ? input.amountPaid - totalAmount : 0;
      if (input.paymentMethod !== "cash" && input.amountPaid !== totalAmount) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Non-cash payments must equal the total amount exactly.",
        });
      }

      const saleNumber = await generateSaleNumber();

      const userId = ctx.userId;

      return db.$transaction(async (tx) => {
        const sale = await tx.pOSSale.create({
          data: {
            saleNumber,
            sessionId: input.sessionId,
            ...(input.customerId !== undefined && { customerId: input.customerId }),
            subtotal,
            taxAmount: input.taxAmount,
            discountAmount: input.discountAmount,
            totalAmount,
            amountPaid: input.amountPaid,
            changeAmount,
            paymentMethod: input.paymentMethod,
            status: "completed",
          },
        });

        for (const item of input.items) {
          const lineTotal = item.quantity * item.unitPrice;
          await tx.pOSSaleItem.create({
            data: {
              saleId: sale.id,
              productId: item.productId,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: lineTotal,
            },
          });
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              type: "out",
              quantity: item.quantity,
              fromWarehouseId: input.warehouseId,
              referenceType: "pos_sale",
              referenceId: sale.id,
              createdById: userId,
              ...(input.notes !== undefined && { notes: input.notes }),
            },
          });
        }

        return sale;
      });
    }),

  void: writeProcedure
    .input(z.object({ id: cuid, reason: z.string().trim().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.userId === null) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const sale = await db.pOSSale.findUnique({
        where: { id: input.id },
        select: { id: true, status: true },
      });
      if (sale === null) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Sale not found." });
      }
      if (sale.status !== "completed") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot void a sale with status "${sale.status}".`,
        });
      }

      // Phase 2: reverse each original out-movement so on-hand stock returns to
      // its source warehouse. Pre-Phase-1 sales (or sales that never produced
      // movements) still flip status cleanly when the find returns [].
      const movements = await db.stockMovement.findMany({
        where: {
          referenceType: "pos_sale",
          referenceId: input.id,
          type: "out",
        },
        select: {
          productId: true,
          quantity: true,
          fromWarehouseId: true,
        },
      });

      const userId = ctx.userId;

      return db.$transaction(async (tx) => {
        for (const m of movements) {
          await tx.stockMovement.create({
            data: {
              productId: m.productId,
              type: "in",
              quantity: m.quantity,
              ...(m.fromWarehouseId !== null && { toWarehouseId: m.fromWarehouseId }),
              referenceType: "pos_sale_void",
              referenceId: input.id,
              createdById: userId,
              notes: input.reason,
            },
          });
        }
        return tx.pOSSale.update({
          where: { id: input.id },
          data: { status: "voided" },
        });
      });
    }),
});

// ── Root router ───────────────────────────────────────────────────────────────

export const posRouter = createTRPCRouter({
  session: sessionRouter,
  sale: saleRouter,
});
