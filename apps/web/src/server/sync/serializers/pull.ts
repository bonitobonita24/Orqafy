/**
 * Server → mobile column-shape serializers for the down-sync (pull) endpoints.
 *
 * These take STRUCTURAL types rather than Prisma model types on purpose: the
 * mapping is the contract the mobile WatermelonDB tables depend on, and keeping
 * it Prisma-free means it is unit-testable without a database and cannot drift
 * silently when a Prisma type changes shape.
 *
 * Column names are snake_case and dates are epoch-ms because that is exactly
 * what WatermelonDB's appSchema declares (apps/mobile/src/storage/schema.ts).
 */

/** Minimal Prisma Decimal surface we rely on. */
interface DecimalLike {
  toNumber(): number;
  toFixed(digits: number): string;
}

export interface TaskPullSource {
  id: string;
  tenantId: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: Date | null;
  projectId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PulledTask {
  server_id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigned_to: string;
  due_date: number | null;
  project_id: string | null;
  created_at: number;
  updated_at: number;
  synced: true;
}

export function serializeTaskForPull(task: TaskPullSource, userId: string): PulledTask {
  return {
    server_id: task.id,
    tenant_id: task.tenantId,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    // The mobile table holds a single scalar assignee. The result set is already
    // filtered to tasks assigned to THIS user, so this is exact for this view.
    assigned_to: userId,
    due_date: task.dueDate?.getTime() ?? null,
    project_id: task.projectId,
    created_at: task.createdAt.getTime(),
    updated_at: task.updatedAt.getTime(),
    // Server-sourced rows are, by definition, in sync.
    synced: true,
  };
}

export interface PayslipPullSource {
  id: string;
  tenantId: string;
  grossPay: DecimalLike;
  netPay: DecimalLike;
  totalDeductions: DecimalLike;
  createdAt: Date;
  updatedAt: Date;
  payroll: {
    periodStart: Date;
    periodEnd: Date;
  };
}

export interface PulledPayslip {
  server_id: string;
  tenant_id: string;
  user_id: string;
  period_start: number;
  period_end: number;
  gross_pay: number;
  net_pay: number;
  deductions: string;
  created_at: number;
  updated_at: number;
}

export function serializePayslipForPull(
  payslip: PayslipPullSource,
  userId: string,
): PulledPayslip {
  return {
    server_id: payslip.id,
    tenant_id: payslip.tenantId,
    user_id: userId,
    // Payslip has no period of its own — it lives on the joined Payroll.
    period_start: payslip.payroll.periodStart.getTime(),
    period_end: payslip.payroll.periodEnd.getTime(),
    gross_pay: payslip.grossPay.toNumber(),
    net_pay: payslip.netPay.toNumber(),
    // The mobile column is a STRING and the screen calls parseFloat() on it.
    // Emitting JSON here would render NaN. Employer shares are excluded —
    // they are employer cost, not an employee deduction.
    deductions: payslip.totalDeductions.toFixed(2),
    created_at: payslip.createdAt.getTime(),
    updated_at: payslip.updatedAt.getTime(),
  };
}
