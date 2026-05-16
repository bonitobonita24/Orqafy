import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, writeProcedure } from "../trpc";
import { prisma as db } from "@orqafy/db";

const CUSTOMER_TIERS = ["regular", "vip", "authorized_dealer"] as const;

const QUOTATION_STATUSES = [
  "draft",
  "sent",
  "accepted",
  "rejected",
  "expired",
  "converted",
] as const;

const MARKUP_TIERS = ["tier1", "tier2", "tier3"] as const;

async function generateQuotationNumber(): Promise<string> {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `QT-${yy}${mm}-`;
  const last = await db.quotation.findFirst({
    where: { quotationNumber: { startsWith: prefix } },
    orderBy: { quotationNumber: "desc" },
    select: { quotationNumber: true },
  });
  const seq = last
    ? parseInt(last.quotationNumber.slice(prefix.length), 10) + 1
    : 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

export const crmRouter = createTRPCRouter({
  // ── Customer ─────────────────────────────────────────────────────────────

  customerList: protectedProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(200).default(50),
        isActive: z.boolean().optional(),
        tier: z.enum(CUSTOMER_TIERS).optional(),
      })
    )
    .query(async ({ input }) => {
      const where = {
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.tier !== undefined ? { tier: input.tier } : {}),
      };
      const [items, total] = await Promise.all([
        db.customer.findMany({
          where,
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          orderBy: { companyName: "asc" },
        }),
        db.customer.count({ where }),
      ]);
      return { items, total, page: input.page, limit: input.limit };
    }),

  customerById: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ input }) => {
      const customer = await db.customer.findUnique({ where: { id: input.id } });
      if (!customer) throw new TRPCError({ code: "NOT_FOUND" });
      return customer;
    }),

  customerCreate: writeProcedure
    .input(
      z.object({
        firstName: z.string().min(1).max(100),
        lastName: z.string().min(1).max(100),
        companyName: z.string().max(255).optional(),
        email: z.string().email().optional(),
        phone: z.string().max(50).optional(),
        address: z.string().max(500).optional(),
        city: z.string().max(100).optional(),
        province: z.string().max(100).optional(),
        postalCode: z.string().max(20).optional(),
        country: z.string().length(2).default("PH"),
        taxId: z.string().max(50).optional(),
        tier: z.enum(CUSTOMER_TIERS).default("regular"),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      return db.customer.create({
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          companyName: input.companyName ?? null,
          email: input.email ?? null,
          phone: input.phone ?? null,
          address: input.address ?? null,
          city: input.city ?? null,
          province: input.province ?? null,
          postalCode: input.postalCode ?? null,
          country: input.country,
          taxId: input.taxId ?? null,
          tier: input.tier,
          notes: input.notes ?? null,
          isActive: true,
          portalEnabled: false,
        },
      });
    }),

  customerUpdate: writeProcedure
    .input(
      z.object({
        id: z.string().min(1),
        firstName: z.string().min(1).max(100).optional(),
        lastName: z.string().min(1).max(100).optional(),
        companyName: z.string().max(255).optional(),
        email: z.string().email().optional(),
        phone: z.string().max(50).optional(),
        address: z.string().max(500).optional(),
        city: z.string().max(100).optional(),
        province: z.string().max(100).optional(),
        postalCode: z.string().max(20).optional(),
        taxId: z.string().max(50).optional(),
        tier: z.enum(CUSTOMER_TIERS).optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      const existing = await db.customer.findUnique({ where: { id } });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      return db.customer.update({
        where: { id },
        data: {
          ...(data.firstName !== undefined ? { firstName: data.firstName } : {}),
          ...(data.lastName !== undefined ? { lastName: data.lastName } : {}),
          ...(data.companyName !== undefined ? { companyName: data.companyName } : {}),
          ...(data.email !== undefined ? { email: data.email } : {}),
          ...(data.phone !== undefined ? { phone: data.phone } : {}),
          ...(data.address !== undefined ? { address: data.address } : {}),
          ...(data.city !== undefined ? { city: data.city } : {}),
          ...(data.province !== undefined ? { province: data.province } : {}),
          ...(data.postalCode !== undefined ? { postalCode: data.postalCode } : {}),
          ...(data.taxId !== undefined ? { taxId: data.taxId } : {}),
          ...(data.tier !== undefined ? { tier: data.tier } : {}),
          ...(data.notes !== undefined ? { notes: data.notes } : {}),
        },
      });
    }),

  customerToggleActive: writeProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const existing = await db.customer.findUnique({ where: { id: input.id } });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      return db.customer.update({
        where: { id: input.id },
        data: { isActive: !existing.isActive },
      });
    }),

  // ── CustomerContact ───────────────────────────────────────────────────────

  contactList: protectedProcedure
    .input(z.object({ customerId: z.string().min(1) }))
    .query(async ({ input }) => {
      return db.customerContact.findMany({
        where: { customerId: input.customerId },
        orderBy: { isPrimary: "desc" },
      });
    }),

  contactCreate: writeProcedure
    .input(
      z.object({
        customerId: z.string().min(1),
        name: z.string().min(1).max(255),
        email: z.string().email().optional(),
        phone: z.string().max(50).optional(),
        position: z.string().max(100).optional(),
        isPrimary: z.boolean().default(false),
      })
    )
    .mutation(async ({ input }) => {
      return db.customerContact.create({
        data: {
          customerId: input.customerId,
          name: input.name,
          email: input.email ?? null,
          phone: input.phone ?? null,
          position: input.position ?? null,
          isPrimary: input.isPrimary,
        },
      });
    }),

  contactUpdate: writeProcedure
    .input(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1).max(255).optional(),
        email: z.string().email().optional(),
        phone: z.string().max(50).optional(),
        position: z.string().max(100).optional(),
        isPrimary: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      const existing = await db.customerContact.findUnique({ where: { id } });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      return db.customerContact.update({
        where: { id },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.email !== undefined ? { email: data.email } : {}),
          ...(data.phone !== undefined ? { phone: data.phone } : {}),
          ...(data.position !== undefined ? { position: data.position } : {}),
          ...(data.isPrimary !== undefined ? { isPrimary: data.isPrimary } : {}),
        },
      });
    }),

  contactDelete: writeProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const existing = await db.customerContact.findUnique({ where: { id: input.id } });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      return db.customerContact.delete({ where: { id: input.id } });
    }),

  // ── CustomerCreditAccount ─────────────────────────────────────────────────

  creditGet: protectedProcedure
    .input(z.object({ customerId: z.string().min(1) }))
    .query(async ({ input }) => {
      return db.customerCreditAccount.findUnique({
        where: { customerId: input.customerId },
      });
    }),

  creditUpsert: writeProcedure
    .input(
      z.object({
        customerId: z.string().min(1),
        creditLimit: z.number().min(0),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      return db.customerCreditAccount.upsert({
        where: { customerId: input.customerId },
        create: {
          customerId: input.customerId,
          creditLimit: input.creditLimit,
          isActive: input.isActive ?? true,
        },
        update: {
          creditLimit: input.creditLimit,
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
      });
    }),

  creditToggleActive: writeProcedure
    .input(z.object({ customerId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const existing = await db.customerCreditAccount.findUnique({
        where: { customerId: input.customerId },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      return db.customerCreditAccount.update({
        where: { customerId: input.customerId },
        data: { isActive: !existing.isActive },
      });
    }),

  // ── Quotation ─────────────────────────────────────────────────────────────
  //
  // Totals rule (locked in DECISIONS_LOG 2026-05-16):
  //   subtotal    = Σ over all line items of (quantity × baseCost)
  //   taxAmount   = caller-supplied (e.g. PH VAT = subtotal × 0.12)
  //   totalAmount = subtotal + taxAmount
  // Markup columns are presentation tiers shown to the customer; they do not
  // change the totals. The accepted price is implicit at status=accepted and
  // is locked at conversion-to-invoice (Phase 3).

  quotationList: protectedProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(200).default(50),
        status: z.enum(QUOTATION_STATUSES).optional(),
        customerId: z.string().min(1).optional(),
      }),
    )
    .query(async ({ input }) => {
      const where = {
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.customerId !== undefined ? { customerId: input.customerId } : {}),
      };
      const [items, total] = await Promise.all([
        db.quotation.findMany({
          where,
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          orderBy: { createdAt: "desc" },
          include: {
            customer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                companyName: true,
              },
            },
            createdBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                displayName: true,
              },
            },
          },
        }),
        db.quotation.count({ where }),
      ]);
      return { items, total, page: input.page, limit: input.limit };
    }),

  quotationById: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ input }) => {
      const quotation = await db.quotation.findUnique({
        where: { id: input.id },
        include: {
          customer: true,
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              displayName: true,
            },
          },
          markupColumns: { orderBy: { sortOrder: "asc" } },
          sections: {
            orderBy: { sortOrder: "asc" },
            include: {
              lineItems: {
                orderBy: { sortOrder: "asc" },
                include: { markups: true },
              },
            },
          },
          revisions: {
            orderBy: { revisionNumber: "desc" },
            take: 10,
            select: { id: true, revisionNumber: true, createdAt: true },
          },
        },
      });
      if (!quotation) throw new TRPCError({ code: "NOT_FOUND" });
      return quotation;
    }),

  quotationCreate: writeProcedure
    .input(
      z.object({
        customerId: z.string().min(1),
        title: z.string().min(1).max(255),
        validUntil: z.date().optional(),
        notes: z.string().optional(),
        termsAndConditions: z.string().optional(),
        currency: z.string().length(3).default("PHP"),
        taxAmount: z.number().nonnegative().default(0),
        markupColumns: z
          .array(
            z.object({
              name: z.string().min(1).max(100),
              tier: z.enum(MARKUP_TIERS),
              percentage: z.number().nonnegative(),
              useCeiling: z.boolean().default(false),
              sortOrder: z.number().int().nonnegative().default(0),
            }),
          )
          .default([]),
        sections: z
          .array(
            z.object({
              name: z.string().min(1).max(255),
              description: z.string().optional(),
              sortOrder: z.number().int().nonnegative().default(0),
              lineItems: z.array(
                z.object({
                  productId: z.string().min(1).optional(),
                  description: z.string().min(1).max(500),
                  unit: z.string().min(1).max(50).default("pcs"),
                  quantity: z.number().positive(),
                  baseCost: z.number().nonnegative(),
                  sortOrder: z.number().int().nonnegative().default(0),
                  markups: z
                    .array(
                      z.object({
                        markupColumnIndex: z.number().int().nonnegative(),
                        markedUpPrice: z.number().nonnegative(),
                      }),
                    )
                    .default([]),
                }),
              ),
            }),
          )
          .min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.userId === null) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }
      const customer = await db.customer.findUnique({
        where: { id: input.customerId },
        select: { id: true },
      });
      if (!customer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found." });
      }

      // Compute totals — subtotal locks at create time.
      const subtotal = input.sections.reduce((acc, section) => {
        return (
          acc +
          section.lineItems.reduce(
            (lineAcc, item) => lineAcc + item.quantity * item.baseCost,
            0,
          )
        );
      }, 0);
      const totalAmount = subtotal + input.taxAmount;

      const quotationNumber = await generateQuotationNumber();
      const userId = ctx.userId;

      return db.$transaction(async (tx) => {
        const quotation = await tx.quotation.create({
          data: {
            quotationNumber,
            customerId: input.customerId,
            createdById: userId,
            title: input.title,
            status: "draft",
            currency: input.currency,
            subtotal,
            taxAmount: input.taxAmount,
            totalAmount,
            ...(input.validUntil !== undefined && { validUntil: input.validUntil }),
            ...(input.notes !== undefined && { notes: input.notes }),
            ...(input.termsAndConditions !== undefined && {
              termsAndConditions: input.termsAndConditions,
            }),
          },
        });

        // Create markup columns and capture their created IDs by index.
        const markupColumnIds: string[] = [];
        for (const col of input.markupColumns) {
          const created = await tx.quotationMarkupColumn.create({
            data: {
              quotationId: quotation.id,
              name: col.name,
              tier: col.tier,
              percentage: col.percentage,
              useCeiling: col.useCeiling,
              sortOrder: col.sortOrder,
            },
          });
          markupColumnIds.push(created.id);
        }

        // Create sections + line items + per-item markups.
        for (const section of input.sections) {
          const createdSection = await tx.quotationSection.create({
            data: {
              quotationId: quotation.id,
              name: section.name,
              sortOrder: section.sortOrder,
              ...(section.description !== undefined && {
                description: section.description,
              }),
            },
          });

          for (const lineItem of section.lineItems) {
            const createdItem = await tx.quotationLineItem.create({
              data: {
                sectionId: createdSection.id,
                description: lineItem.description,
                unit: lineItem.unit,
                quantity: lineItem.quantity,
                baseCost: lineItem.baseCost,
                sortOrder: lineItem.sortOrder,
                ...(lineItem.productId !== undefined && {
                  productId: lineItem.productId,
                }),
              },
            });

            for (const markup of lineItem.markups) {
              const colId = markupColumnIds[markup.markupColumnIndex];
              if (colId === undefined) {
                throw new TRPCError({
                  code: "BAD_REQUEST",
                  message: `Line item references unknown markup column index ${markup.markupColumnIndex}.`,
                });
              }
              await tx.quotationLineItemMarkup.create({
                data: {
                  lineItemId: createdItem.id,
                  markupColumnId: colId,
                  markedUpPrice: markup.markedUpPrice,
                },
              });
            }
          }
        }

        // Initial revision snapshot at draft creation (revisionNumber=1).
        await tx.quotationRevision.create({
          data: {
            quotationId: quotation.id,
            revisionNumber: 1,
            snapshot: {
              status: "draft",
              subtotal,
              taxAmount: input.taxAmount,
              totalAmount,
              capturedAt: new Date().toISOString(),
            },
          },
        });

        return quotation;
      });
    }),

  quotationUpdate: writeProcedure
    .input(
      z.object({
        id: z.string().min(1),
        title: z.string().min(1).max(255).optional(),
        validUntil: z.date().nullable().optional(),
        notes: z.string().optional(),
        termsAndConditions: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const existing = await db.quotation.findUnique({
        where: { id: input.id },
        select: { id: true, status: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      if (existing.status !== "draft") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot edit a quotation with status "${existing.status}". Create a revision first.`,
        });
      }
      return db.quotation.update({
        where: { id: input.id },
        data: {
          ...(input.title !== undefined && { title: input.title }),
          ...(input.validUntil !== undefined && { validUntil: input.validUntil }),
          ...(input.notes !== undefined && { notes: input.notes }),
          ...(input.termsAndConditions !== undefined && {
            termsAndConditions: input.termsAndConditions,
          }),
        },
      });
    }),

  quotationSend: writeProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const existing = await db.quotation.findUnique({
        where: { id: input.id },
        select: { id: true, status: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      if (existing.status !== "draft") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Only draft quotations can be sent (current status: ${existing.status}).`,
        });
      }
      return db.quotation.update({
        where: { id: input.id },
        data: { status: "sent", sentAt: new Date() },
      });
    }),

  quotationAccept: writeProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const existing = await db.quotation.findUnique({
        where: { id: input.id },
        select: { id: true, status: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      if (existing.status !== "sent") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Only sent quotations can be accepted (current status: ${existing.status}).`,
        });
      }
      return db.quotation.update({
        where: { id: input.id },
        data: { status: "accepted", acceptedAt: new Date() },
      });
    }),

  quotationReject: writeProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const existing = await db.quotation.findUnique({
        where: { id: input.id },
        select: { id: true, status: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      if (existing.status !== "sent") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Only sent quotations can be rejected (current status: ${existing.status}).`,
        });
      }
      return db.quotation.update({
        where: { id: input.id },
        data: { status: "rejected" },
      });
    }),

  quotationCreateRevision: writeProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const existing = await db.quotation.findUnique({
        where: { id: input.id },
        include: {
          markupColumns: true,
          sections: { include: { lineItems: { include: { markups: true } } } },
          revisions: {
            orderBy: { revisionNumber: "desc" },
            take: 1,
            select: { revisionNumber: true },
          },
        },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      if (existing.status === "converted") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot revise a converted quotation.",
        });
      }
      const nextNumber = (existing.revisions[0]?.revisionNumber ?? 0) + 1;

      return db.$transaction(async (tx) => {
        await tx.quotationRevision.create({
          data: {
            quotationId: existing.id,
            revisionNumber: nextNumber,
            snapshot: {
              status: existing.status,
              subtotal: existing.subtotal.toString(),
              taxAmount: existing.taxAmount.toString(),
              totalAmount: existing.totalAmount.toString(),
              sections: existing.sections.map((s) => ({
                id: s.id,
                name: s.name,
                description: s.description,
                sortOrder: s.sortOrder,
                lineItems: s.lineItems.map((li) => ({
                  id: li.id,
                  productId: li.productId,
                  description: li.description,
                  unit: li.unit,
                  quantity: li.quantity.toString(),
                  baseCost: li.baseCost.toString(),
                  sortOrder: li.sortOrder,
                  markups: li.markups.map((m) => ({
                    markupColumnId: m.markupColumnId,
                    markedUpPrice: m.markedUpPrice.toString(),
                  })),
                })),
              })),
              markupColumns: existing.markupColumns.map((c) => ({
                id: c.id,
                name: c.name,
                tier: c.tier,
                percentage: c.percentage.toString(),
                useCeiling: c.useCeiling,
                sortOrder: c.sortOrder,
              })),
              capturedAt: new Date().toISOString(),
            },
          },
        });
        return tx.quotation.update({
          where: { id: existing.id },
          data: { status: "draft" },
        });
      });
    }),
});
