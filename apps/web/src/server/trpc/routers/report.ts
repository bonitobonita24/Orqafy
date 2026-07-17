import { z } from "zod";
import { createTRPCRouter } from "../trpc";
import { matrixProcedure } from "../middleware/matrix";
import { prisma as db } from "@orqafy/db";

// Migrated to the data-driven `role_permissions` matrix (feature key
// "reports"). This router is read-only — every endpoint is a query, so all
// procedures map to the "view" action.
const reportsViewProcedure = matrixProcedure("reports", "view");

export const reportRouter = createTRPCRouter({
  dashboardKPIs: reportsViewProcedure
    .input(
      z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const dateFilter =
        input.startDate !== undefined || input.endDate !== undefined
          ? {
              createdAt: {
                ...(input.startDate !== undefined ? { gte: input.startDate } : {}),
                ...(input.endDate !== undefined ? { lte: input.endDate } : {}),
              },
            }
          : {};

      const tenantScope = { tenantId: ctx.tenantId };

      const [
        invoiceStats,
        expenseStats,
        jobOrderStats,
        customerCount,
        projectCount,
        employeeCount,
      ] = await Promise.all([
        db.invoice.aggregate({
          where: { ...tenantScope, ...dateFilter },
          _sum: { totalAmount: true },
          _count: { id: true },
        }),
        db.expense.aggregate({
          where: { ...tenantScope, ...dateFilter },
          _sum: { amount: true },
          _count: { id: true },
        }),
        db.jobOrder.groupBy({
          by: ["status"],
          where: { ...tenantScope, ...dateFilter },
          _count: { id: true },
        }),
        db.customer.count({ where: tenantScope }),
        db.project.count({ where: tenantScope }),
        db.employee.count({ where: tenantScope }),
      ]);

      return {
        revenue: {
          total: invoiceStats._sum.totalAmount ?? 0,
          invoiceCount: invoiceStats._count.id,
        },
        expenses: {
          total: expenseStats._sum.amount ?? 0,
          expenseCount: expenseStats._count.id,
        },
        jobOrders: Object.fromEntries(
          jobOrderStats.map((s: { status: string; _count: { id: number } }) => [s.status, s._count.id])
        ),
        counts: { customers: customerCount, projects: projectCount, employees: employeeCount },
      };
    }),

  revenueByPeriod: reportsViewProcedure
    .input(
      z.object({
        startDate: z.date(),
        endDate: z.date(),
      })
    )
    .query(async ({ ctx, input }) => {
      const invoices = await db.invoice.findMany({
        where: {
          tenantId: ctx.tenantId,
          status: "paid",
          paidAt: { gte: input.startDate, lte: input.endDate },
        },
        select: { paidAt: true, totalAmount: true },
        orderBy: { paidAt: "asc" },
      });
      return invoices;
    }),

  invoicesByStatus: reportsViewProcedure.query(async ({ ctx }) => {
    return db.invoice.groupBy({
      by: ["status"],
      where: { tenantId: ctx.tenantId },
      _count: { id: true },
      _sum: { totalAmount: true },
    });
  }),

  expensesByCategory: reportsViewProcedure
    .input(
      z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const dateFilter =
        input.startDate !== undefined || input.endDate !== undefined
          ? {
              date: {
                ...(input.startDate !== undefined ? { gte: input.startDate } : {}),
                ...(input.endDate !== undefined ? { lte: input.endDate } : {}),
              },
            }
          : {};

      const grouped = await db.expense.groupBy({
        by: ["expenseCategoryId"],
        where: {
          tenantId: ctx.tenantId,
          status: "approved",
          ...dateFilter,
        },
        _sum: { amount: true },
        _count: { id: true },
      });

      // Resolve category names so consumers (e.g. the chart) can label by name
      // instead of the raw id. groupBy can't join, so map ids → names here.
      const categories = await db.expenseCategory.findMany({
        where: {
          tenantId: ctx.tenantId,
          id: { in: grouped.map((g) => g.expenseCategoryId) },
        },
        select: { id: true, name: true },
      });
      const nameById = new Map(categories.map((c) => [c.id, c.name]));

      return grouped.map((g) => ({
        ...g,
        categoryName: nameById.get(g.expenseCategoryId) ?? "Uncategorized",
      }));
    }),

  topClients: reportsViewProcedure
    .input(z.object({ limit: z.number().int().min(1).max(20).default(10) }))
    .query(async ({ ctx, input }) => {
      return db.invoice.groupBy({
        by: ["customerId"],
        where: { tenantId: ctx.tenantId, status: "paid" },
        _sum: { totalAmount: true },
        _count: { id: true },
        orderBy: { _sum: { totalAmount: "desc" } },
        take: input.limit,
      });
    }),

  payrollSummary: reportsViewProcedure
    .input(
      z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const dateFilter =
        input.startDate !== undefined || input.endDate !== undefined
          ? {
              periodStart: {
                ...(input.startDate !== undefined ? { gte: input.startDate } : {}),
                ...(input.endDate !== undefined ? { lte: input.endDate } : {}),
              },
            }
          : {};

      return db.payroll.aggregate({
        where: {
          tenantId: ctx.tenantId,
          status: "paid",
          ...dateFilter,
        },
        _sum: { totalGross: true, totalNet: true, totalDeductions: true },
        _count: { id: true },
      });
    }),
});
