/**
 * demo-hr-extras.ts
 *
 * Enriches the DEMO tenant's HR/DTR/Payroll data beyond demo-showcase.ts's
 * baseline (which only seeds present/late attendance, one approved leave
 * request, and a single paid payroll run). This file adds the states needed
 * to exercise approval workflows and payroll history/reporting:
 *
 *   1. PENDING attendance records (awaiting approval)
 *   2. A PENDING leave request (awaiting approval)
 *   3. Additional Payroll runs (draft / processing / paid) with payslips,
 *      for prior semi-monthly periods — gives payroll history a real spread
 *   4. CashAdvanceRecovery installments against the existing demo cash advance
 *
 * TypeScript strict: no `any`. Decimal fields passed as money()-formatted
 * strings per demo-seed-utils conventions. Idempotent per sub-block — each
 * block guards on a marker distinct from demo-showcase.ts's own seeded rows,
 * so re-running this file (or demo-showcase.ts) never duplicates data.
 */

import type { PrismaClient } from '@prisma/client';
import { money, daysAgo, dateAgo, at, num, round2 } from './demo-seed-utils';

export async function seedHrExtras(prisma: PrismaClient, tenantId: string): Promise<void> {
  const employees = await prisma.employee.findMany({
    where: { tenantId },
    select: { id: true, baseSalary: true },
    take: 10,
  });

  if (employees.length === 0) {
    console.log('  ⏭  HR extras: no employees found for tenant. Skipping (run seedHrPayroll first).');
    return;
  }

  // ── 1. Pending attendance records (awaiting approval) ─────────────────────
  // demo-showcase.ts seeds 5 weekday records per employee within back<12 days.
  // Use a distinct, further-back window so @@unique([employeeId, date]) never collides.
  const pendingAttendanceExisting = await prisma.attendanceRecord.count({
    where: { tenantId, status: 'pending' },
  });
  if (pendingAttendanceExisting === 0) {
    let pendingCount = 0;
    for (let i = 0; i < Math.min(employees.length, 3); i++) {
      const empId = at(employees, i).id;
      let created = 0;
      let back = 15;
      while (created < 2 && back < 25) {
        const d = dateAgo(back);
        const dow = d.getDay();
        if (dow !== 0 && dow !== 6) {
          const clockIn = new Date(d);
          clockIn.setHours(8, 5, 0, 0);
          await prisma.attendanceRecord.create({
            data: {
              tenantId,
              employeeId: empId,
              date: d,
              clockIn,
              clockOut: null,
              status: 'pending',
              overtimeMinutes: 0,
              notes: 'Awaiting supervisor approval (demo).',
            },
          });
          created++;
          pendingCount++;
        }
        back++;
      }
    }
    console.log(`  ✅ HR extras: ${pendingCount} pending attendance records`);
  } else {
    console.log('  ⏭  HR extras: pending attendance already seeded. Skipping.');
  }

  // ── 2. Pending leave request (awaiting approval) ──────────────────────────
  const pendingLeaveExisting = await prisma.leaveRequest.count({
    where: { tenantId, status: 'pending' },
  });
  if (pendingLeaveExisting === 0) {
    const secondEmp = employees.length > 1 ? at(employees, 1).id : at(employees, 0).id;
    await prisma.leaveRequest.create({
      data: {
        tenantId,
        employeeId: secondEmp,
        type: 'sick',
        startDate: dateAgo(-3),
        endDate: dateAgo(-2),
        totalDays: '2.0',
        reason: 'Flu — doctor advised rest (demo).',
        status: 'pending',
      },
    });
    console.log('  ✅ HR extras: 1 pending leave request');
  } else {
    console.log('  ⏭  HR extras: pending leave request already seeded. Skipping.');
  }

  // ── 3. Additional payroll runs (draft / processing / paid) with payslips ──
  const extraPayrollExisting = await prisma.payroll.findFirst({
    where: { tenantId, payrollNumber: 'DEMO-PR-0002' },
    select: { id: true },
  });
  if (extraPayrollExisting === null) {
    const runs: Array<{
      payrollNumber: string;
      status: string;
      periodBackStart: number;
      periodBackEnd: number;
      processed: boolean;
      paid: boolean;
    }> = [
      { payrollNumber: 'DEMO-PR-0002', status: 'paid', periodBackStart: 60, periodBackEnd: 46, processed: true, paid: true },
      { payrollNumber: 'DEMO-PR-0003', status: 'processing', periodBackStart: 45, periodBackEnd: 31, processed: true, paid: false },
      { payrollNumber: 'DEMO-PR-0004', status: 'draft', periodBackStart: 15, periodBackEnd: 1, processed: false, paid: false },
    ];

    let runsCreated = 0;
    let payslipsCreated = 0;
    for (const run of runs) {
      let totalGross = 0;
      let totalDed = 0;
      let totalNet = 0;
      const slipData = employees.map((e) => {
        const basic = e.baseSalary ? Number(e.baseSalary) : 28000;
        const gross = basic;
        const sss = round2(basic * 0.045);
        const philhealth = round2(basic * 0.02);
        const pagibig = 100;
        const tax = round2(basic * 0.05);
        const totalDeductions = round2(sss + philhealth + pagibig + tax);
        const net = round2(gross - totalDeductions);
        totalGross += gross;
        totalDed += totalDeductions;
        totalNet += net;
        return { employeeId: e.id, basic, gross, sss, philhealth, pagibig, tax, totalDeductions, net };
      });

      await prisma.payroll.create({
        data: {
          tenantId,
          payrollNumber: run.payrollNumber,
          periodStart: dateAgo(run.periodBackStart),
          periodEnd: dateAgo(run.periodBackEnd),
          status: run.status,
          totalGross: money(totalGross),
          totalDeductions: money(totalDed),
          totalNet: money(totalNet),
          currency: 'PHP',
          processedAt: run.processed ? daysAgo(run.periodBackEnd - 1) : null,
          paidAt: run.paid ? daysAgo(run.periodBackEnd - 2) : null,
          notes: `Semi-monthly payroll — ${run.status} (demo history).`,
          payslips: {
            create: slipData.map((s) => ({
              tenantId,
              employeeId: s.employeeId,
              basicPay: money(s.basic),
              grossPay: money(s.gross),
              sssDeduction: money(s.sss),
              philhealthDeduction: money(s.philhealth),
              pagibigDeduction: money(s.pagibig),
              taxDeduction: money(s.tax),
              totalDeductions: money(s.totalDeductions),
              netPay: money(s.net),
              sssEmployerShare: money(round2(s.basic * 0.095)),
              philhealthEmployerShare: money(s.philhealth),
              pagibigEmployerShare: money(100),
            })),
          },
        },
      });
      runsCreated++;
      payslipsCreated += slipData.length;
    }
    console.log(`  ✅ HR extras: ${runsCreated} additional payroll runs (${payslipsCreated} payslips)`);
  } else {
    console.log('  ⏭  HR extras: additional payroll runs already seeded. Skipping.');
  }

  // ── 4. Cash advance recovery installments ──────────────────────────────────
  const recoveryExisting = await prisma.cashAdvanceRecovery.count({ where: { tenantId } });
  if (recoveryExisting === 0) {
    const cashAdvance = await prisma.cashAdvance.findFirst({
      where: { tenantId, status: { in: ['approved', 'partially_recovered'] } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, employeeId: true, amount: true, totalRecovered: true },
    });

    if (cashAdvance === null) {
      console.log('  ⏭  HR extras: no cash advance found to recover against. Skipping (run seedHrPayroll first).');
    } else {
      const payslip = await prisma.payslip.findFirst({
        where: { tenantId, employeeId: cashAdvance.employeeId },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });

      const installments = [
        { amount: 1500, back: 12 },
        { amount: 1500, back: 5 },
      ];
      let recoveredTotal = Number(cashAdvance.totalRecovered);
      for (let i = 0; i < installments.length; i++) {
        const inst = at(installments, i);
        await prisma.cashAdvanceRecovery.create({
          data: {
            tenantId,
            cashAdvanceId: cashAdvance.id,
            payslipId: payslip?.id ?? null,
            amount: money(inst.amount),
            recoveredAt: daysAgo(inst.back),
          },
        });
        recoveredTotal += inst.amount;
      }

      const advanceAmount = Number(cashAdvance.amount);
      const newStatus = recoveredTotal >= advanceAmount ? 'fully_recovered' : 'partially_recovered';
      await prisma.cashAdvance.update({
        where: { id: cashAdvance.id },
        data: { totalRecovered: money(recoveredTotal), status: newStatus },
      });

      console.log(
        `  ✅ HR extras: ${installments.length} cash advance recovery installments (${num(Math.round(recoveredTotal))} total recovered, status=${newStatus})`,
      );
    }
  } else {
    console.log('  ⏭  HR extras: cash advance recoveries already seeded. Skipping.');
  }
}
