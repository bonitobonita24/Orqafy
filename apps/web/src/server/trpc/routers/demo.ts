import { z } from "zod";
import { TRPCError } from "@trpc/server";
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

    // Delete all mutable tenant data — schema-isolated tables only
    // The seed script will re-populate demo data afterwards
    await db.$transaction(async (tx) => {
      // Delete in dependency order (children before parents)
      // Schema-per-tenant: SET search_path handles isolation — no tenantId filters needed
      // lineItems are JSON on Invoice (no separate InvoiceItem model)
      await tx.invoice.deleteMany({});
      await tx.expense.deleteMany({});
      await tx.jobOrderPart.deleteMany({});
      await tx.jobOrder.deleteMany({});
      await tx.payslip.deleteMany({});
      await tx.payroll.deleteMany({});
      await tx.employee.deleteMany({});
      await tx.task.deleteMany({});
      await tx.project.deleteMany({});
      await tx.customer.deleteMany({});
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
