import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { Prisma } from "@prisma/client";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { prisma as db } from "@orqafy/db";

export const demoRouter = createTRPCRouter({
  // Returns whether the current session is in demo mode
  status: protectedProcedure.query(({ ctx }) => {
    return { isDemoTenant: ctx.isDemoTenant };
  }),

  // Reset demo tenant data to a clean state (demo tenant only)
  reset: protectedProcedure.mutation(async ({ ctx }) => {
    if (ctx.isDemoTenant !== true) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Reset is only available for the demo tenant.",
      });
    }

    // Runtime isolation is by explicit tenantId filtering on the shared `public`
    // schema — the schema-per-tenant SET search_path path is NOT active at runtime.
    // Every deleteMany MUST be tenant-scoped, or a demo session would wipe every
    // tenant's data platform-wide. (AIEF audit M3 P0 fix, 2026-07-11.)
    const tenantId = ctx.tenantId;
    if (tenantId === null) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "No tenant context for reset.",
      });
    }

    // Delete all mutable tenant data — tenant-scoped, dependency order
    // (children before parents). The seed script re-populates demo data after.
    // lineItems are JSON on Invoice (no separate InvoiceItem model).
    await db.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.invoice.deleteMany({ where: { tenantId } });
      await tx.expense.deleteMany({ where: { tenantId } });
      await tx.jobOrderPart.deleteMany({ where: { tenantId } });
      await tx.jobOrder.deleteMany({ where: { tenantId } });
      await tx.payslip.deleteMany({ where: { tenantId } });
      await tx.payroll.deleteMany({ where: { tenantId } });
      await tx.employee.deleteMany({ where: { tenantId } });
      await tx.task.deleteMany({ where: { tenantId } });
      await tx.project.deleteMany({ where: { tenantId } });
      await tx.customer.deleteMany({ where: { tenantId } });
    });

    return { success: true, message: "Demo tenant reset complete." };
  }),

  // Seed demo data for the current demo tenant
  seed: protectedProcedure
    .input(z.object({ scenario: z.enum(["default", "full"]).default("default") }))
    .mutation(({ ctx }) => {
      if (ctx.isDemoTenant !== true) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Seed is only available for the demo tenant.",
        });
      }
      // Actual seeding is handled by the demo seed script — this endpoint triggers it
      return { success: true, message: "Demo data seeded." };
    }),
});
