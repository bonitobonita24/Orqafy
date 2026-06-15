import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, writeProcedure } from "../trpc";
import { prisma as db, writeAuditLog } from "@orqafy/db";

// ── Tenant-scoped loaders ─────────────────────────────────────────────────────

async function loadPayrollForTenant(id: string, ctx: { tenantId: string }) {
  const p = await db.payroll.findUnique({ where: { id } });
  if (!p || p.tenantId !== ctx.tenantId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Payroll run not found" });
  }
  return p;
}

async function loadPayslipForTenant(id: string, ctx: { tenantId: string }) {
  const ps = await db.payslip.findUnique({ where: { id } });
  if (!ps || ps.tenantId !== ctx.tenantId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Payslip not found" });
  }
  return ps;
}

async function loadEmployeeForTenant(id: string, ctx: { tenantId: string }) {
  const emp = await db.employee.findUnique({ where: { id } });
  if (!emp || emp.tenantId !== ctx.tenantId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Employee not found" });
  }
  return emp;
}

// ── Payslip line input schema ──────────────────────────────────────────────────
// Fields are manually-entered amounts (data-entry only — no computation).
// HOLD(owner-rule): grossPay / totalDeductions / netPay are stored as-entered;
//   automatic computation from DTR/attendance/PH statutory formulas is deferred.

const payslipInputSchema = z.object({
  employeeId: z.string().cuid(),
  basicPay: z.number().min(0),
  overtimePay: z.number().min(0).default(0),
  allowances: z.number().min(0).default(0),
  // Deductions entered manually — owner-supplied formula HOLD
  sssDeduction: z.number().min(0).default(0),
  philhealthDeduction: z.number().min(0).default(0),
  pagibigDeduction: z.number().min(0).default(0),
  taxDeduction: z.number().min(0).default(0),
  cashAdvanceDeduction: z.number().min(0).default(0),
  otherDeductions: z.number().min(0).default(0),
});

// ── Payslip sub-router ────────────────────────────────────────────────────────

const payslipRouter = createTRPCRouter({
  listByRun: protectedProcedure
    .input(z.object({ payrollId: z.string().cuid() }))
    .query(async ({ input, ctx }) => {
      await loadPayrollForTenant(input.payrollId, ctx);
      return db.payslip.findMany({
        where: { payrollId: input.payrollId, tenantId: ctx.tenantId },
        include: {
          employee: {
            include: {
              user: { select: { firstName: true, lastName: true, displayName: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      });
    }),

  add: writeProcedure
    .input(
      payslipInputSchema.extend({
        payrollId: z.string().cuid(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const payroll = await loadPayrollForTenant(input.payrollId, ctx);
      if (payroll.status !== "draft") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Payslips can only be added to draft payroll runs.",
        });
      }
      await loadEmployeeForTenant(input.employeeId, ctx);

      // Form-level data derivation (same pattern as JE debit==credit validation)
      const grossPay = input.basicPay + input.overtimePay + input.allowances;
      const totalDeductions =
        input.sssDeduction +
        input.philhealthDeduction +
        input.pagibigDeduction +
        input.taxDeduction +
        input.cashAdvanceDeduction +
        input.otherDeductions;
      const netPay = grossPay - totalDeductions;

      return db.$transaction(async (tx) => {
        const created = await tx.payslip.create({
          data: {
            tenantId: ctx.tenantId,
            payrollId: input.payrollId,
            employeeId: input.employeeId,
            basicPay: input.basicPay,
            overtimePay: input.overtimePay,
            allowances: input.allowances,
            grossPay,
            sssDeduction: input.sssDeduction,
            philhealthDeduction: input.philhealthDeduction,
            pagibigDeduction: input.pagibigDeduction,
            taxDeduction: input.taxDeduction,
            cashAdvanceDeduction: input.cashAdvanceDeduction,
            otherDeductions: input.otherDeductions,
            totalDeductions,
            netPay,
          },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "CREATE",
          entity: "Payslip",
          entityId: created.id,
          before: null,
          after: {
            payrollId: input.payrollId,
            employeeId: input.employeeId,
            basicPay: input.basicPay,
            grossPay,
            netPay,
          },
        });
        return created;
      });
    }),

  update: writeProcedure
    .input(
      payslipInputSchema.partial().extend({
        id: z.string().cuid(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const existing = await loadPayslipForTenant(input.id, ctx);
      const payroll = await loadPayrollForTenant(existing.payrollId, ctx);
      if (payroll.status !== "draft") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Payslips can only be edited on draft payroll runs.",
        });
      }

      const basicPay = input.basicPay ?? Number(existing.basicPay);
      const overtimePay = input.overtimePay ?? Number(existing.overtimePay);
      const allowances = input.allowances ?? Number(existing.allowances);
      const sssDeduction = input.sssDeduction ?? Number(existing.sssDeduction);
      const philhealthDeduction = input.philhealthDeduction ?? Number(existing.philhealthDeduction);
      const pagibigDeduction = input.pagibigDeduction ?? Number(existing.pagibigDeduction);
      const taxDeduction = input.taxDeduction ?? Number(existing.taxDeduction);
      const cashAdvanceDeduction =
        input.cashAdvanceDeduction ?? Number(existing.cashAdvanceDeduction);
      const otherDeductions = input.otherDeductions ?? Number(existing.otherDeductions);

      const grossPay = basicPay + overtimePay + allowances;
      const totalDeductions =
        sssDeduction +
        philhealthDeduction +
        pagibigDeduction +
        taxDeduction +
        cashAdvanceDeduction +
        otherDeductions;
      const netPay = grossPay - totalDeductions;

      return db.$transaction(async (tx) => {
        const updated = await tx.payslip.update({
          where: { id: input.id },
          data: {
            basicPay,
            overtimePay,
            allowances,
            grossPay,
            sssDeduction,
            philhealthDeduction,
            pagibigDeduction,
            taxDeduction,
            cashAdvanceDeduction,
            otherDeductions,
            totalDeductions,
            netPay,
          },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "UPDATE",
          entity: "Payslip",
          entityId: input.id,
          before: {
            basicPay: Number(existing.basicPay),
            grossPay: Number(existing.grossPay),
            netPay: Number(existing.netPay),
          },
          after: { basicPay, grossPay, netPay },
        });
        return updated;
      });
    }),

  remove: writeProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ input, ctx }) => {
      const existing = await loadPayslipForTenant(input.id, ctx);
      const payroll = await loadPayrollForTenant(existing.payrollId, ctx);
      if (payroll.status !== "draft") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Payslips can only be removed from draft payroll runs.",
        });
      }
      return db.$transaction(async (tx) => {
        await tx.payslip.delete({ where: { id: input.id } });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "DELETE",
          entity: "Payslip",
          entityId: input.id,
          before: {
            payrollId: existing.payrollId,
            employeeId: existing.employeeId,
            netPay: Number(existing.netPay),
          },
          after: null,
        });
        return { id: input.id };
      });
    }),
});

// ── Payroll run router ────────────────────────────────────────────────────────

export const payrollRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(200).default(50),
        status: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const where = {
        tenantId: ctx.tenantId,
        ...(input.status !== undefined && input.status !== "" ? { status: input.status } : {}),
      };
      const [items, total] = await Promise.all([
        db.payroll.findMany({
          where,
          include: { _count: { select: { payslips: true } } },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          orderBy: { periodStart: "desc" },
        }),
        db.payroll.count({ where }),
      ]);
      return { items, total, page: input.page, limit: input.limit };
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ input, ctx }) => {
      await loadPayrollForTenant(input.id, ctx);
      const item = await db.payroll.findUnique({
        where: { id: input.id },
        include: {
          payslips: {
            include: {
              employee: {
                include: {
                  user: { select: { firstName: true, lastName: true, displayName: true } },
                },
              },
            },
          },
        },
      });
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });
      return item;
    }),

  create: writeProcedure
    .input(
      z.object({
        periodStart: z.string().min(1), // ISO date string "YYYY-MM-DD"
        periodEnd: z.string().min(1),
        label: z.string().max(200).optional(),
        currency: z.string().length(3).default("PHP"),
        notes: z.string().max(1000).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const count = await db.payroll.count({ where: { tenantId: ctx.tenantId } });
      const payrollNumber = `PAY-${String(count + 1).padStart(4, "0")}`;
      return db.$transaction(async (tx) => {
        const created = await tx.payroll.create({
          data: {
            tenantId: ctx.tenantId,
            periodStart: new Date(input.periodStart),
            periodEnd: new Date(input.periodEnd),
            currency: input.currency,
            notes: input.notes ?? null,
            payrollNumber,
            status: "draft",
          },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "CREATE",
          entity: "Payroll",
          entityId: created.id,
          before: null,
          after: {
            payrollNumber: created.payrollNumber,
            periodStart: input.periodStart,
            periodEnd: input.periodEnd,
            status: "draft",
          },
        });
        return created;
      });
    }),

  update: writeProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        periodStart: z.string().min(1).optional(),
        periodEnd: z.string().min(1).optional(),
        currency: z.string().length(3).optional(),
        notes: z.string().max(1000).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const existing = await loadPayrollForTenant(input.id, ctx);
      if (existing.status !== "draft") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only draft payroll runs can be edited.",
        });
      }
      return db.$transaction(async (tx) => {
        const updated = await tx.payroll.update({
          where: { id: input.id },
          data: {
            ...(input.periodStart !== undefined
              ? { periodStart: new Date(input.periodStart) }
              : {}),
            ...(input.periodEnd !== undefined ? { periodEnd: new Date(input.periodEnd) } : {}),
            ...(input.currency !== undefined ? { currency: input.currency } : {}),
            ...(input.notes !== undefined ? { notes: input.notes } : {}),
          },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "UPDATE",
          entity: "Payroll",
          entityId: input.id,
          before: {
            periodStart: existing.periodStart,
            periodEnd: existing.periodEnd,
            currency: existing.currency,
          },
          after: {
            periodStart: updated.periodStart,
            periodEnd: updated.periodEnd,
            currency: updated.currency,
          },
        });
        return updated;
      });
    }),

  // HOLD(owner-rule): process — transitions run from draft→processing; deferred pending
  //   owner-supplied rules for auto-generation of payslips from DTR/attendance data.
  process: writeProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ input, ctx }) => {
      const existing = await loadPayrollForTenant(input.id, ctx);
      if (existing.status !== "draft") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only draft payrolls can be processed." });
      }
      // HOLD(owner-rule): auto-generation of payslips from DTR/attendance not implemented.
      return db.payroll.update({
        where: { id: input.id },
        data: { status: "processing", processedAt: new Date() },
      });
    }),

  // HOLD(owner-rule): approve — transitions run from processing→approved.
  //   Full approval workflow with approver identity + notifications deferred.
  approve: writeProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ input, ctx }) => {
      const existing = await loadPayrollForTenant(input.id, ctx);
      if (existing.status !== "processing") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only processing payrolls can be approved." });
      }
      return db.payroll.update({
        where: { id: input.id },
        data: { status: "approved" },
      });
    }),

  // HOLD(owner-rule): markPaid — transitions run from approved→paid.
  //   FundSource deduction + Journal Entry posting (Core Flow 8) deferred.
  markPaid: writeProcedure
    .input(z.object({ id: z.string().cuid(), paidAt: z.date().optional() }))
    .mutation(async ({ input, ctx }) => {
      const existing = await loadPayrollForTenant(input.id, ctx);
      if (existing.status !== "approved") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only approved payrolls can be marked as paid." });
      }
      return db.payroll.update({
        where: { id: input.id },
        data: { status: "paid", paidAt: input.paidAt ?? new Date() },
      });
    }),

  payslip: payslipRouter,
});
