import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, writeProcedure } from "../trpc";
import { matrixProcedure, matrixMiddleware } from "../middleware/matrix";
import { prisma as db, writeAuditLog } from "@orqafy/db";

// Migrated to the data-driven `role_permissions` matrix (feature key "crm").
// Reads use `matrixProcedure` (protectedProcedure + matrixMiddleware); mutations
// compose `writeProcedure.use(matrixMiddleware(...))` so the demo-tenant mutation
// guard survives alongside the matrix grant check.
// Status-transition mutations (customerToggleActive, creditUpsert/ToggleActive,
// quotationSend/Accept/Reject/CreateRevision/ConvertToInvoice, contactLogUpdate,
// quotationUpdate's full-payload replace-children path) all map to "update" —
// they mutate an existing entity, they don't create or delete it. contactDelete
// and contactLogDelete hard-delete their own row and map to "delete".
const crmViewProcedure = matrixProcedure("crm", "view");
const crmCreateProcedure = writeProcedure.use(matrixMiddleware("crm", "create"));
const crmUpdateProcedure = writeProcedure.use(matrixMiddleware("crm", "update"));
const crmDeleteProcedure = writeProcedure.use(matrixMiddleware("crm", "delete"));

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

const CONTACT_LOG_TYPES = ["call", "email", "meeting", "note"] as const;

async function loadCustomerForTenant(
  id: string,
  ctx: { tenantId: string },
) {
  const c = await db.customer.findUnique({ where: { id } });
  if (!c || c.tenantId !== ctx.tenantId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
  }
  return c;
}

async function loadCustomerCreditAccountForTenant(
  customerId: string,
  ctx: { tenantId: string },
) {
  const cca = await db.customerCreditAccount.findUnique({
    where: { customerId },
  });
  if (!cca || cca.tenantId !== ctx.tenantId) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Credit account not found",
    });
  }
  return cca;
}

async function loadQuotationForTenant(
  id: string,
  ctx: { tenantId: string },
) {
  const q = await db.quotation.findUnique({ where: { id } });
  if (!q || q.tenantId !== ctx.tenantId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Quotation not found" });
  }
  return q;
}

async function loadContactLogForTenant(
  id: string,
  ctx: { tenantId: string },
) {
  const cl = await db.contactLog.findUnique({ where: { id } });
  if (!cl || cl.tenantId !== ctx.tenantId) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Contact log not found",
    });
  }
  return cl;
}

async function validateProductIdsForTenant(
  productIds: string[],
  ctx: { tenantId: string },
): Promise<void> {
  const uniqueIds = Array.from(new Set(productIds));
  if (uniqueIds.length === 0) return;
  const count = await db.product.count({
    where: { id: { in: uniqueIds }, tenantId: ctx.tenantId },
  });
  if (count !== uniqueIds.length) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "One or more line items reference a product that does not belong to this tenant.",
    });
  }
}

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

  customerList: crmViewProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(200).default(50),
        isActive: z.boolean().optional(),
        tier: z.enum(CUSTOMER_TIERS).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }
      const where = {
        tenantId: ctx.tenantId,
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

  customerById: crmViewProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }
      return loadCustomerForTenant(input.id, { tenantId: ctx.tenantId });
    }),

  customerCreate: crmCreateProcedure
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
      }).strict()
    )
    .mutation(async ({ ctx, input }) => {
      return db.$transaction(async (tx) => {
        const created = await tx.customer.create({
          data: {
            tenantId: ctx.tenantId,
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
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "CREATE",
          entity: "Customer",
          entityId: created.id,
          before: null,
          after: { id: created.id, firstName: created.firstName, lastName: created.lastName, companyName: created.companyName, tier: created.tier, isActive: created.isActive },
        });
        return created;
      });
    }),

  customerUpdate: crmUpdateProcedure
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
      }).strict()
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const prev = await loadCustomerForTenant(id, { tenantId: ctx.tenantId });
      return db.$transaction(async (tx) => {
        const updated = await tx.customer.update({
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
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "UPDATE",
          entity: "Customer",
          entityId: id,
          before: { firstName: prev.firstName, lastName: prev.lastName, companyName: prev.companyName, tier: prev.tier, email: prev.email, phone: prev.phone },
          after: { firstName: updated.firstName, lastName: updated.lastName, companyName: updated.companyName, tier: updated.tier, email: updated.email, phone: updated.phone },
        });
        return updated;
      });
    }),

  customerToggleActive: crmUpdateProcedure
    .input(z.object({ id: z.string().min(1) }).strict())
    .mutation(async ({ ctx, input }) => {
      const existing = await loadCustomerForTenant(input.id, {
        tenantId: ctx.tenantId,
      });
      return db.$transaction(async (tx) => {
        const updated = await tx.customer.update({
          where: { id: input.id },
          data: { isActive: !existing.isActive },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "UPDATE",
          entity: "Customer",
          entityId: input.id,
          before: { isActive: existing.isActive },
          after: { isActive: updated.isActive },
        });
        return updated;
      });
    }),

  // ── CustomerContact ───────────────────────────────────────────────────────

  contactList: crmViewProcedure
    .input(z.object({ customerId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await loadCustomerForTenant(input.customerId, ctx);
      return db.customerContact.findMany({
        where: { customerId: input.customerId },
        orderBy: { isPrimary: "desc" },
      });
    }),

  contactCreate: crmCreateProcedure
    .input(
      z.object({
        customerId: z.string().min(1),
        name: z.string().min(1).max(255),
        email: z.string().email().optional(),
        phone: z.string().max(50).optional(),
        position: z.string().max(100).optional(),
        isPrimary: z.boolean().default(false),
      }).strict()
    )
    .mutation(async ({ ctx, input }) => {
      await loadCustomerForTenant(input.customerId, ctx);
      return db.$transaction(async (tx) => {
        const created = await tx.customerContact.create({
          data: {
            tenantId: ctx.tenantId,
            customerId: input.customerId,
            name: input.name,
            email: input.email ?? null,
            phone: input.phone ?? null,
            position: input.position ?? null,
            isPrimary: input.isPrimary,
          },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "CREATE",
          entity: "CustomerContact",
          entityId: created.id,
          before: null,
          after: { id: created.id, customerId: created.customerId, name: created.name, email: created.email, isPrimary: created.isPrimary },
        });
        return created;
      });
    }),

  contactUpdate: crmUpdateProcedure
    .input(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1).max(255).optional(),
        email: z.string().email().optional(),
        phone: z.string().max(50).optional(),
        position: z.string().max(100).optional(),
        isPrimary: z.boolean().optional(),
      }).strict()
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const existing = await db.customerContact.findUnique({ where: { id } });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      await loadCustomerForTenant(existing.customerId, ctx);
      return db.$transaction(async (tx) => {
        const updated = await tx.customerContact.update({
          where: { id },
          data: {
            ...(data.name !== undefined ? { name: data.name } : {}),
            ...(data.email !== undefined ? { email: data.email } : {}),
            ...(data.phone !== undefined ? { phone: data.phone } : {}),
            ...(data.position !== undefined ? { position: data.position } : {}),
            ...(data.isPrimary !== undefined ? { isPrimary: data.isPrimary } : {}),
          },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "UPDATE",
          entity: "CustomerContact",
          entityId: id,
          before: { name: existing.name, email: existing.email, phone: existing.phone, position: existing.position, isPrimary: existing.isPrimary },
          after: { name: updated.name, email: updated.email, phone: updated.phone, position: updated.position, isPrimary: updated.isPrimary },
        });
        return updated;
      });
    }),

  contactDelete: crmDeleteProcedure
    .input(z.object({ id: z.string().min(1) }).strict())
    .mutation(async ({ ctx, input }) => {
      const existing = await db.customerContact.findUnique({ where: { id: input.id } });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      await loadCustomerForTenant(existing.customerId, ctx);
      return db.$transaction(async (tx) => {
        const deleted = await tx.customerContact.delete({ where: { id: input.id } });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "DELETE",
          entity: "CustomerContact",
          entityId: input.id,
          before: { id: existing.id, customerId: existing.customerId, name: existing.name, email: existing.email, isPrimary: existing.isPrimary },
          after: null,
        });
        return deleted;
      });
    }),

  // ── CustomerCreditAccount ─────────────────────────────────────────────────

  creditGet: crmViewProcedure
    .input(z.object({ customerId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }
      await loadCustomerForTenant(input.customerId, {
        tenantId: ctx.tenantId,
      });
      return db.customerCreditAccount.findUnique({
        where: { customerId: input.customerId },
      });
    }),

  creditUpsert: crmUpdateProcedure
    .input(
      z.object({
        customerId: z.string().min(1),
        creditLimit: z.number().min(0),
        isActive: z.boolean().optional(),
      }).strict()
    )
    .mutation(async ({ ctx, input }) => {
      await loadCustomerForTenant(input.customerId, {
        tenantId: ctx.tenantId,
      });
      const prevCca = await db.customerCreditAccount.findUnique({ where: { customerId: input.customerId } });
      return db.$transaction(async (tx) => {
        const result = await tx.customerCreditAccount.upsert({
          where: { customerId: input.customerId },
          create: {
            tenantId: ctx.tenantId,
            customerId: input.customerId,
            creditLimit: input.creditLimit,
            isActive: input.isActive ?? true,
          },
          update: {
            creditLimit: input.creditLimit,
            ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          },
        });
        const isCreate = prevCca === null;
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: isCreate ? "CREATE" : "UPDATE",
          entity: "CustomerCreditAccount",
          entityId: result.id,
          before: isCreate ? null : { creditLimit: Number(prevCca.creditLimit), isActive: prevCca.isActive },
          after: { creditLimit: Number(result.creditLimit), isActive: result.isActive },
        });
        return result;
      });
    }),

  creditToggleActive: crmUpdateProcedure
    .input(z.object({ customerId: z.string().min(1) }).strict())
    .mutation(async ({ ctx, input }) => {
      const existing = await loadCustomerCreditAccountForTenant(
        input.customerId,
        { tenantId: ctx.tenantId },
      );
      return db.$transaction(async (tx) => {
        const updated = await tx.customerCreditAccount.update({
          where: { customerId: input.customerId },
          data: { isActive: !existing.isActive },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "UPDATE",
          entity: "CustomerCreditAccount",
          entityId: existing.id,
          before: { isActive: existing.isActive },
          after: { isActive: updated.isActive },
        });
        return updated;
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

  quotationList: crmViewProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(200).default(50),
        status: z.enum(QUOTATION_STATUSES).optional(),
        customerId: z.string().min(1).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const where = {
        tenantId: ctx.tenantId,
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

  quotationById: crmViewProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const quotation = await db.quotation.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId },
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

  quotationCreate: crmCreateProcedure
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
      }).strict(),
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.userId === null) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }
      await loadCustomerForTenant(input.customerId, {
        tenantId: ctx.tenantId,
      });
      await validateProductIdsForTenant(
        input.sections.flatMap((section) =>
          section.lineItems
            .map((item) => item.productId)
            .filter((id): id is string => id !== undefined),
        ),
        { tenantId: ctx.tenantId },
      );

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

      const tenantId = ctx.tenantId;
      return db.$transaction(async (tx) => {
        const quotation = await tx.quotation.create({
          data: {
            tenantId,
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
              tenantId,
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
              tenantId,
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
                tenantId,
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
                  tenantId,
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
            tenantId,
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

        await writeAuditLog(tx, {
          userId: userId,
          action: "CREATE",
          entity: "Quotation",
          entityId: quotation.id,
          before: null,
          after: { id: quotation.id, quotationNumber: quotation.quotationNumber, customerId: quotation.customerId, status: quotation.status, subtotal: Number(quotation.subtotal), totalAmount: Number(quotation.totalAmount) },
        });

        return quotation;
      });
    }),

  quotationUpdate: crmUpdateProcedure
    .input(
      z.object({
        id: z.string().min(1),
        title: z.string().min(1).max(255).optional(),
        validUntil: z.date().nullable().optional(),
        notes: z.string().optional(),
        termsAndConditions: z.string().optional(),
        taxAmount: z.number().nonnegative().optional(),
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
          .optional(),
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
          .optional(),
      }).strict(),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await loadQuotationForTenant(input.id, {
        tenantId: ctx.tenantId,
      });
      if (existing.status !== "draft") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot edit a quotation with status "${existing.status}". Create a revision first.`,
        });
      }

      // Header-only update path — when sections/markupColumns not provided.
      if (input.sections === undefined && input.markupColumns === undefined) {
        return db.$transaction(async (tx) => {
          const updated = await tx.quotation.update({
            where: { id: input.id },
            data: {
              ...(input.title !== undefined && { title: input.title }),
              ...(input.validUntil !== undefined && { validUntil: input.validUntil }),
              ...(input.notes !== undefined && { notes: input.notes }),
              ...(input.termsAndConditions !== undefined && {
                termsAndConditions: input.termsAndConditions,
              }),
              ...(input.taxAmount !== undefined && { taxAmount: input.taxAmount }),
            },
          });
          await writeAuditLog(tx, {
            userId: ctx.userId,
            action: "UPDATE",
            entity: "Quotation",
            entityId: input.id,
            before: { title: existing.title, status: existing.status, taxAmount: Number(existing.taxAmount), totalAmount: Number(existing.totalAmount) },
            after: { title: updated.title, status: updated.status, taxAmount: Number(updated.taxAmount), totalAmount: Number(updated.totalAmount) },
          });
          return updated;
        });
      }

      // Full-payload edit — replace children atomically and recompute totals.
      // Cascade deletion: removing sections cascades to lineItems and their markups;
      // removing markupColumns cascades to any remaining lineItemMarkups.
      if (input.sections === undefined || input.markupColumns === undefined) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Full-payload edit requires both sections and markupColumns.",
        });
      }
      const sectionsInput = input.sections;
      const markupColumnsInput = input.markupColumns;
      await validateProductIdsForTenant(
        sectionsInput.flatMap((section) =>
          section.lineItems
            .map((item) => item.productId)
            .filter((id): id is string => id !== undefined),
        ),
        { tenantId: ctx.tenantId },
      );
      const taxAmount = input.taxAmount ?? 0;
      const subtotal = sectionsInput.reduce((acc, section) => {
        return (
          acc +
          section.lineItems.reduce(
            (lineAcc, item) => lineAcc + item.quantity * item.baseCost,
            0,
          )
        );
      }, 0);
      const totalAmount = subtotal + taxAmount;
      const tenantId = ctx.tenantId;

      return db.$transaction(async (tx) => {
        await tx.quotationSection.deleteMany({ where: { quotationId: input.id } });
        await tx.quotationMarkupColumn.deleteMany({ where: { quotationId: input.id } });

        const markupColumnIds: string[] = [];
        for (const col of markupColumnsInput) {
          const created = await tx.quotationMarkupColumn.create({
            data: {
              tenantId,
              quotationId: input.id,
              name: col.name,
              tier: col.tier,
              percentage: col.percentage,
              useCeiling: col.useCeiling,
              sortOrder: col.sortOrder,
            },
          });
          markupColumnIds.push(created.id);
        }

        for (const section of sectionsInput) {
          const createdSection = await tx.quotationSection.create({
            data: {
              tenantId,
              quotationId: input.id,
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
                tenantId,
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
                  tenantId,
                  lineItemId: createdItem.id,
                  markupColumnId: colId,
                  markedUpPrice: markup.markedUpPrice,
                },
              });
            }
          }
        }

        const updated = await tx.quotation.update({
          where: { id: input.id },
          data: {
            subtotal,
            taxAmount,
            totalAmount,
            ...(input.title !== undefined && { title: input.title }),
            ...(input.validUntil !== undefined && { validUntil: input.validUntil }),
            ...(input.notes !== undefined && { notes: input.notes }),
            ...(input.termsAndConditions !== undefined && {
              termsAndConditions: input.termsAndConditions,
            }),
          },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "UPDATE",
          entity: "Quotation",
          entityId: input.id,
          before: { title: existing.title, status: existing.status, subtotal: Number(existing.subtotal), taxAmount: Number(existing.taxAmount), totalAmount: Number(existing.totalAmount) },
          after: { title: updated.title, status: updated.status, subtotal: Number(updated.subtotal), taxAmount: Number(updated.taxAmount), totalAmount: Number(updated.totalAmount) },
        });
        return updated;
      });
    }),

  quotationSend: crmUpdateProcedure
    .input(z.object({ id: z.string().min(1) }).strict())
    .mutation(async ({ ctx, input }) => {
      const existing = await loadQuotationForTenant(input.id, {
        tenantId: ctx.tenantId,
      });
      if (existing.status !== "draft") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Only draft quotations can be sent (current status: ${existing.status}).`,
        });
      }
      return db.$transaction(async (tx) => {
        const updated = await tx.quotation.update({
          where: { id: input.id },
          data: { status: "sent", sentAt: new Date() },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "UPDATE",
          entity: "Quotation",
          entityId: input.id,
          before: { status: existing.status },
          after: { status: updated.status },
        });
        return updated;
      });
    }),

  quotationAccept: crmUpdateProcedure
    .input(z.object({ id: z.string().min(1) }).strict())
    .mutation(async ({ ctx, input }) => {
      const existing = await loadQuotationForTenant(input.id, {
        tenantId: ctx.tenantId,
      });
      if (existing.status !== "sent") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Only sent quotations can be accepted (current status: ${existing.status}).`,
        });
      }
      return db.$transaction(async (tx) => {
        const updated = await tx.quotation.update({
          where: { id: input.id },
          data: { status: "accepted", acceptedAt: new Date() },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "UPDATE",
          entity: "Quotation",
          entityId: input.id,
          before: { status: existing.status },
          after: { status: updated.status },
        });
        return updated;
      });
    }),

  quotationReject: crmUpdateProcedure
    .input(z.object({ id: z.string().min(1) }).strict())
    .mutation(async ({ ctx, input }) => {
      const existing = await loadQuotationForTenant(input.id, {
        tenantId: ctx.tenantId,
      });
      if (existing.status !== "sent") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Only sent quotations can be rejected (current status: ${existing.status}).`,
        });
      }
      return db.$transaction(async (tx) => {
        const updated = await tx.quotation.update({
          where: { id: input.id },
          data: { status: "rejected" },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "UPDATE",
          entity: "Quotation",
          entityId: input.id,
          before: { status: existing.status },
          after: { status: updated.status },
        });
        return updated;
      });
    }),

  quotationCreateRevision: crmUpdateProcedure
    .input(z.object({ id: z.string().min(1) }).strict())
    .mutation(async ({ ctx, input }) => {
      const existing = await db.quotation.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId },
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
      const tenantId = ctx.tenantId;

      return db.$transaction(async (tx) => {
        await tx.quotationRevision.create({
          data: {
            tenantId,
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
        const updated = await tx.quotation.update({
          where: { id: existing.id },
          data: { status: "draft" },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "UPDATE",
          entity: "Quotation",
          entityId: existing.id,
          before: { status: existing.status, revisionNumber: existing.revisions[0]?.revisionNumber ?? null },
          after: { status: updated.status, revisionNumber: nextNumber },
        });
        return updated;
      });
    }),

  quotationConvertToInvoice: crmUpdateProcedure
    .input(
      z.object({
        id: z.string().min(1),
        markupColumnId: z.string().min(1).optional(),
        dueDate: z.date().optional(),
        notes: z.string().max(1000).optional(),
      }).strict(),
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.userId === null) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }
      const existing = await db.quotation.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId },
        include: {
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
        },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      if (existing.status !== "accepted") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Only accepted quotations can be converted (current status: ${existing.status}).`,
        });
      }
      if (existing.convertedToInvoiceId !== null) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This quotation has already been converted to an invoice.",
        });
      }
      if (existing.markupColumns.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Quotation has no markup columns to derive prices from.",
        });
      }

      const selectedColumn =
        input.markupColumnId !== undefined
          ? existing.markupColumns.find((c) => c.id === input.markupColumnId)
          : existing.markupColumns[0];
      if (!selectedColumn) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Selected markup column not found on quotation.",
        });
      }

      const invoiceLineItems: Array<{
        description: string;
        quantity: number;
        unitPrice: number;
      }> = [];
      let subtotal = 0;
      for (const section of existing.sections) {
        for (const li of section.lineItems) {
          const markup = li.markups.find(
            (m) => m.markupColumnId === selectedColumn.id,
          );
          const unitPrice =
            markup !== undefined ? Number(markup.markedUpPrice) : 0;
          const qty = Number(li.quantity);
          subtotal += qty * unitPrice;
          invoiceLineItems.push({
            description: li.description,
            quantity: qty,
            unitPrice,
          });
        }
      }

      const origSubtotal = Number(existing.subtotal);
      const origTax = Number(existing.taxAmount);
      const taxRate = origSubtotal > 0 ? origTax / origSubtotal : 0;
      const taxAmount = subtotal * taxRate;
      const totalAmount = subtotal + taxAmount;

      const invoiceNumber = `INV-${Date.now()}`;
      const dueDate =
        input.dueDate ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const userId = ctx.userId;

      return db.$transaction(async (tx) => {
        const invoice = await tx.invoice.create({
          data: {
            tenantId: ctx.tenantId,
            invoiceNumber,
            customerId: existing.customerId,
            createdById: userId,
            quotationId: existing.id,
            status: "draft",
            subtotal,
            taxAmount,
            totalAmount,
            balance: totalAmount,
            amountPaid: 0,
            currency: existing.currency,
            dueDate,
            lineItems: invoiceLineItems,
            ...(input.notes !== undefined && { notes: input.notes }),
            ...(existing.termsAndConditions !== null && {
              termsAndConditions: existing.termsAndConditions,
            }),
          },
          select: { id: true, invoiceNumber: true },
        });
        await tx.quotation.update({
          where: { id: existing.id },
          data: {
            status: "converted",
            convertedToInvoiceId: invoice.id,
          },
        });
        await writeAuditLog(tx, {
          userId: userId,
          action: "UPDATE",
          entity: "Quotation",
          entityId: existing.id,
          before: { status: existing.status, convertedToInvoiceId: existing.convertedToInvoiceId },
          after: { status: "converted", convertedToInvoiceId: invoice.id },
        });
        return invoice;
      });
    }),

  // ── ContactLog ────────────────────────────────────────────────────────────

  contactLogList: crmViewProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(200).default(50),
        customerId: z.string().min(1).optional(),
        type: z.enum(CONTACT_LOG_TYPES).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const where = {
        tenantId: ctx.tenantId,
        ...(input.customerId !== undefined ? { customerId: input.customerId } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
      };
      const [items, total] = await Promise.all([
        db.contactLog.findMany({
          where,
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          orderBy: { occurredAt: "desc" },
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
        db.contactLog.count({ where }),
      ]);
      return { items, total, page: input.page, limit: input.limit };
    }),

  contactLogById: crmViewProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const log = await db.contactLog.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId },
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
      });
      if (!log) throw new TRPCError({ code: "NOT_FOUND" });
      return log;
    }),

  contactLogListForCustomer: crmViewProcedure
    .input(
      z.object({
        customerId: z.string().min(1),
        limit: z.number().int().min(1).max(200).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      return db.contactLog.findMany({
        where: { customerId: input.customerId, tenantId: ctx.tenantId },
        take: input.limit,
        orderBy: { occurredAt: "desc" },
        include: {
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              displayName: true,
            },
          },
        },
      });
    }),

  contactLogCreate: crmCreateProcedure
    .input(
      z.object({
        customerId: z.string().min(1),
        type: z.enum(CONTACT_LOG_TYPES),
        subject: z.string().min(1).max(255),
        body: z.string().max(5000).optional(),
        occurredAt: z.date().optional(),
      }).strict(),
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.userId === null) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }
      await loadCustomerForTenant(input.customerId, {
        tenantId: ctx.tenantId,
      });
      const userId = ctx.userId;
      return db.$transaction(async (tx) => {
        const created = await tx.contactLog.create({
          data: {
            tenantId: ctx.tenantId,
            customerId: input.customerId,
            createdById: userId,
            type: input.type,
            subject: input.subject,
            occurredAt: input.occurredAt ?? new Date(),
            ...(input.body !== undefined && { body: input.body }),
          },
        });
        await writeAuditLog(tx, {
          userId: userId,
          action: "CREATE",
          entity: "ContactLog",
          entityId: created.id,
          before: null,
          after: { id: created.id, customerId: created.customerId, type: created.type, subject: created.subject },
        });
        return created;
      });
    }),

  contactLogUpdate: crmUpdateProcedure
    .input(
      z.object({
        id: z.string().min(1),
        type: z.enum(CONTACT_LOG_TYPES).optional(),
        subject: z.string().min(1).max(255).optional(),
        body: z.string().max(5000).nullable().optional(),
        occurredAt: z.date().optional(),
      }).strict(),
    )
    .mutation(async ({ ctx, input }) => {
      const prev = await loadContactLogForTenant(input.id, { tenantId: ctx.tenantId });
      return db.$transaction(async (tx) => {
        const updated = await tx.contactLog.update({
          where: { id: input.id },
          data: {
            ...(input.type !== undefined && { type: input.type }),
            ...(input.subject !== undefined && { subject: input.subject }),
            ...(input.body !== undefined && { body: input.body }),
            ...(input.occurredAt !== undefined && { occurredAt: input.occurredAt }),
          },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "UPDATE",
          entity: "ContactLog",
          entityId: input.id,
          before: { type: prev.type, subject: prev.subject, body: prev.body },
          after: { type: updated.type, subject: updated.subject, body: updated.body },
        });
        return updated;
      });
    }),

  contactLogDelete: crmDeleteProcedure
    .input(z.object({ id: z.string().min(1) }).strict())
    .mutation(async ({ ctx, input }) => {
      const prev = await loadContactLogForTenant(input.id, { tenantId: ctx.tenantId });
      return db.$transaction(async (tx) => {
        await tx.contactLog.delete({ where: { id: input.id } });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "DELETE",
          entity: "ContactLog",
          entityId: input.id,
          before: { id: prev.id, customerId: prev.customerId, type: prev.type, subject: prev.subject },
          after: null,
        });
        return { id: input.id };
      });
    }),
});
