import { z } from "zod";

export const employmentTypeSchema = z.enum([
  "full_time",
  "part_time",
  "contractual",
]);

export const employeeSchema = z.object({
  id: z.string(),
  userId: z.string(),
  employeeNo: z.string(),
  position: z.string(),
  department: z.string(),
  employmentType: employmentTypeSchema,
  hireDate: z.coerce.date(),
  salary: z.number(),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const attendanceRecordClockInLocationSchema = z.enum([
  "office",
  "project_site",
]);
export const attendanceRecordStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
]);

export const attendanceRecordSchema = z.object({
  id: z.string(),
  userId: z.string(),
  date: z.coerce.date(),
  clockInTime: z.coerce.date(),
  clockInLat: z.number().nullable(),
  clockInLng: z.number().nullable(),
  clockInLocation: attendanceRecordClockInLocationSchema,
  clockOutTime: z.coerce.date().nullable(),
  clockOutLat: z.number().nullable(),
  clockOutLng: z.number().nullable(),
  workLocation: z.string().nullable(),
  projectId: z.string().nullable(),
  status: attendanceRecordStatusSchema,
  approvedById: z.string().nullable(),
  approvedAt: z.coerce.date().nullable(),
  notes: z.string().nullable(),
  isSyncedFromOffline: z.boolean(),
  createdAt: z.coerce.date(),
});

export const attendanceStatusSchema = z.enum([
  "present",
  "absent",
  "late",
  "half_day",
]);

export const attendanceSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  attendanceRecordId: z.string(),
  date: z.coerce.date(),
  hoursWorked: z.number(),
  status: attendanceStatusSchema,
});

export const leaveTypeSchema = z.enum(["vacation", "sick", "emergency"]);
export const leaveRequestStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
]);

export const leaveRequestSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  type: leaveTypeSchema,
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  status: leaveRequestStatusSchema,
  approvedById: z.string().nullable(),
  createdAt: z.coerce.date(),
});

export const cashAdvanceStatusSchema = z.enum([
  "pending",
  "approved",
  "released",
  "partially_recovered",
  "fully_recovered",
]);

export const cashAdvanceSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  amount: z.number(),
  fundSourceId: z.string(),
  isProjectLinked: z.boolean(),
  projectId: z.string().nullable(),
  purpose: z.string(),
  status: cashAdvanceStatusSchema,
  approvedById: z.string().nullable(),
  releasedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
});

export const cashAdvanceRecoverySchema = z.object({
  id: z.string(),
  cashAdvanceId: z.string(),
  payrollId: z.string(),
  amountDeducted: z.number(),
  remainingBalance: z.number(),
  createdAt: z.coerce.date(),
});

export const payrollStatusSchema = z.enum(["draft", "approved", "released"]);

export const payrollSchema = z.object({
  id: z.string(),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  status: payrollStatusSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const payslipDeductionSchema = z.object({
  label: z.string(),
  amount: z.number(),
});

export const payslipAdditionSchema = z.object({
  label: z.string(),
  amount: z.number(),
});

export const payslipCashAdvanceDeductionSchema = z.object({
  cashAdvanceId: z.string(),
  amount: z.number(),
});

export const payslipSchema = z.object({
  id: z.string(),
  payrollId: z.string(),
  employeeId: z.string(),
  basicPay: z.number(),
  deductions: z.array(payslipDeductionSchema),
  additions: z.array(payslipAdditionSchema),
  cashAdvanceDeductions: z.array(payslipCashAdvanceDeductionSchema),
  netPay: z.number(),
  fundSourceId: z.string(),
  createdAt: z.coerce.date(),
});
