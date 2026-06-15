import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, writeProcedure } from "../trpc";
import { prisma as db, writeAuditLog } from "@orqafy/db";
import { Prisma } from "@prisma/client";
import {
  computePayslip,
  resolveRatesFromRows,
  DEFAULT_RATE_CONFIGS,
  DEFAULT_RATE_SOURCES,
  type StatutoryRateType,
} from "@/server/lib/payroll-compute";
import { resolveAccountingDefaults, postJournalEntryTx, type JournalPostLine } from "@/server/lib/journal-posting";

const STATUTORY_RATE_TYPES = ["sss", "philhealth", "pagibig", "withholding"] as const;

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

  // process (§C): compute PH statutory deductions for every payslip in the run from
  //   the tenant's configurable StatutoryRate table (cited 2025 defaults as fallback),
  //   then transition draft→processing. Re-runnable while in draft.
  process: writeProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ input, ctx }) => {
      const existing = await loadPayrollForTenant(input.id, ctx);
      if (existing.status !== "draft") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only draft payrolls can be processed." });
      }

      const rateRows = await db.statutoryRate.findMany({ where: { tenantId: ctx.tenantId } });
      const rates = resolveRatesFromRows(rateRows);
      const payslips = await db.payslip.findMany({
        where: { payrollId: input.id, tenantId: ctx.tenantId },
      });

      return db.$transaction(async (tx) => {
        let totalGross = 0;
        let totalDeductions = 0;
        let totalNet = 0;
        for (const ps of payslips) {
          const result = computePayslip(
            {
              basicPay: Number(ps.basicPay),
              overtimePay: Number(ps.overtimePay),
              allowances: Number(ps.allowances),
              cashAdvanceDeduction: Number(ps.cashAdvanceDeduction),
              otherDeductions: Number(ps.otherDeductions),
            },
            rates,
          );
          totalGross += result.grossPay;
          totalDeductions += result.totalDeductions;
          totalNet += result.netPay;
          await tx.payslip.update({
            where: { id: ps.id },
            data: {
              grossPay: result.grossPay,
              sssDeduction: result.sssDeduction,
              philhealthDeduction: result.philhealthDeduction,
              pagibigDeduction: result.pagibigDeduction,
              taxDeduction: result.taxDeduction,
              totalDeductions: result.totalDeductions,
              netPay: result.netPay,
              sssEmployerShare: result.sssEmployerShare,
              philhealthEmployerShare: result.philhealthEmployerShare,
              pagibigEmployerShare: result.pagibigEmployerShare,
              deductionDetails: result.breakdown as Prisma.InputJsonValue,
            },
          });
        }
        const updated = await tx.payroll.update({
          where: { id: input.id },
          data: {
            status: "processing",
            processedAt: new Date(),
            totalGross: Math.round((totalGross + Number.EPSILON) * 100) / 100,
            totalDeductions: Math.round((totalDeductions + Number.EPSILON) * 100) / 100,
            totalNet: Math.round((totalNet + Number.EPSILON) * 100) / 100,
          },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "PROCESS",
          entity: "Payroll",
          entityId: input.id,
          before: { status: "draft" },
          after: { status: "processing", totalNet: Number(updated.totalNet) },
        });
        return updated;
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

  // markPaid (§C / Core Flow 8): APPROVED→PAID deducts the chosen FundSource for net pay
  //   + employer remittances, and posts a payroll JE
  //   (DR salaries + employer-statutory expense, CR Accounts Payable for the full credit).
  //   Account mapping is resolved from AccountingSettings; unset → clear configuration error.
  markPaid: writeProcedure
    .input(z.object({ id: z.string().cuid(), fundSourceId: z.string().cuid(), paidAt: z.date().optional() }))
    .mutation(async ({ input, ctx }) => {
      const existing = await loadPayrollForTenant(input.id, ctx);
      if (existing.status !== "approved") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only approved payrolls can be marked as paid." });
      }
      const fundSource = await db.fundSource.findUnique({ where: { id: input.fundSourceId } });
      if (!fundSource || fundSource.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Fund source not found" });
      }
      const payslips = await db.payslip.findMany({
        where: { payrollId: input.id, tenantId: ctx.tenantId },
      });
      if (payslips.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Payroll has no payslips to pay." });
      }

      const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
      const totalNet = round2(payslips.reduce((s, p) => s + Number(p.netPay), 0));
      const totalGross = round2(payslips.reduce((s, p) => s + Number(p.grossPay), 0));
      const employerCost = round2(
        payslips.reduce(
          (s, p) =>
            s + Number(p.sssEmployerShare) + Number(p.philhealthEmployerShare) + Number(p.pagibigEmployerShare),
          0,
        ),
      );
      const totalEmployeeDeductions = round2(payslips.reduce((s, p) => s + Number(p.totalDeductions), 0));
      // Salaries + employer statutory expense (DR) == net + EE deductions + employer cost (CR).
      const totalExpense = round2(totalGross + employerCost);
      const totalCredit = round2(totalNet + totalEmployeeDeductions + employerCost);

      const newBalance = round2(Number(fundSource.currentBalance) - totalNet);

      // Resolve GL mapping (expense + AP + fiscal year required).
      const defaults = await resolveAccountingDefaults(db, ctx.tenantId, ["expense", "ap", "fiscalYear"]);

      return db.$transaction(async (tx) => {
        // 1. Deduct FundSource for net pay (cash out) + record the transaction.
        await tx.fundSource.update({
          where: { id: input.fundSourceId },
          data: { currentBalance: newBalance },
        });
        await tx.fundTransaction.create({
          data: {
            tenantId: ctx.tenantId,
            fundSourceId: input.fundSourceId,
            type: "withdrawal",
            amount: totalNet,
            runningBalance: newBalance,
            referenceType: "payroll",
            referenceId: input.id,
            description: `Payroll ${existing.payrollNumber} net pay`,
            category: "payroll",
            createdById: ctx.userId,
          },
        });

        // 2. Post payroll JE.
        const lines: JournalPostLine[] = [
          { accountId: defaults.expenseAccountId!, debit: totalExpense, description: "Salaries + employer statutory expense" },
          { accountId: defaults.apAccountId!, credit: totalCredit, description: "Net pay + statutory payables" },
        ];
        const je = await postJournalEntryTx(tx, {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          fiscalYearId: defaults.fiscalYearId!,
          date: input.paidAt ?? new Date(),
          description: `Payroll ${existing.payrollNumber}`,
          referenceType: "payroll",
          referenceId: input.id,
          lines,
        });

        const updated = await tx.payroll.update({
          where: { id: input.id },
          data: { status: "paid", paidAt: input.paidAt ?? new Date() },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "MARK_PAID",
          entity: "Payroll",
          entityId: input.id,
          before: { status: "approved" },
          after: { status: "paid", journalEntryId: je.id, fundSourceId: input.fundSourceId, totalNet },
        });
        return updated;
      });
    }),

  // ── Statutory rate sub-router (§C — owner-configurable, cited, effective-dated) ──
  statutoryRate: createTRPCRouter({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.statutoryRate.findMany({
        where: { tenantId: ctx.tenantId },
        orderBy: [{ type: "asc" }, { effectiveFrom: "desc" }],
      });
    }),

    // Effective values currently applied (resolved from rows + cited defaults).
    resolved: protectedProcedure.query(async ({ ctx }) => {
      const rows = await db.statutoryRate.findMany({ where: { tenantId: ctx.tenantId } });
      return resolveRatesFromRows(rows);
    }),

    upsert: writeProcedure
      .input(
        z.object({
          type: z.enum(STATUTORY_RATE_TYPES),
          config: z.record(z.string(), z.unknown()),
          source: z.string().min(1).max(500),
          effectiveFrom: z.string().min(1),
          isActive: z.boolean().default(true),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        return db.$transaction(async (tx) => {
          const created = await tx.statutoryRate.create({
            data: {
              tenantId: ctx.tenantId,
              type: input.type,
              config: input.config as Prisma.InputJsonValue,
              source: input.source,
              effectiveFrom: new Date(input.effectiveFrom),
              isActive: input.isActive,
            },
          });
          await writeAuditLog(tx, {
            userId: ctx.userId,
            action: "CREATE",
            entity: "StatutoryRate",
            entityId: created.id,
            before: null,
            after: { type: created.type, source: created.source, effectiveFrom: created.effectiveFrom },
          });
          return created;
        });
      }),

    // Seed the cited 2025 PH defaults for this tenant (idempotent per type).
    seedDefaults: writeProcedure.mutation(async ({ ctx }) => {
      const existing = await db.statutoryRate.findMany({ where: { tenantId: ctx.tenantId } });
      const have = new Set(existing.map((r) => r.type));
      const toCreate = (STATUTORY_RATE_TYPES as readonly StatutoryRateType[]).filter((t) => !have.has(t));
      if (toCreate.length === 0) return { created: 0 };
      await db.statutoryRate.createMany({
        data: toCreate.map((t) => ({
          tenantId: ctx.tenantId,
          type: t,
          config: DEFAULT_RATE_CONFIGS[t] as object,
          source: DEFAULT_RATE_SOURCES[t],
          effectiveFrom: new Date("2025-01-01"),
          isActive: true,
        })),
      });
      return { created: toCreate.length };
    }),
  }),

  payslip: payslipRouter,
});
