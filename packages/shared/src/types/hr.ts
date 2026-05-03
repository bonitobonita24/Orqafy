export type EmploymentType = "full_time" | "part_time" | "contractual";

export type Employee = {
  id: string;
  userId: string;
  employeeNo: string;
  position: string;
  department: string;
  employmentType: EmploymentType;
  hireDate: Date;
  salary: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type AttendanceRecordClockInLocation = "office" | "project_site";
export type AttendanceRecordStatus = "pending" | "approved" | "rejected";

export type AttendanceRecord = {
  id: string;
  userId: string;
  date: Date;
  clockInTime: Date;
  clockInLat: number | null;
  clockInLng: number | null;
  clockInLocation: AttendanceRecordClockInLocation;
  clockOutTime: Date | null;
  clockOutLat: number | null;
  clockOutLng: number | null;
  workLocation: string | null;
  projectId: string | null;
  status: AttendanceRecordStatus;
  approvedById: string | null;
  approvedAt: Date | null;
  notes: string | null;
  isSyncedFromOffline: boolean;
  createdAt: Date;
};

export type AttendanceStatus = "present" | "absent" | "late" | "half_day";

export type Attendance = {
  id: string;
  employeeId: string;
  attendanceRecordId: string;
  date: Date;
  hoursWorked: number;
  status: AttendanceStatus;
};

export type LeaveType = "vacation" | "sick" | "emergency";
export type LeaveRequestStatus = "pending" | "approved" | "rejected";

export type LeaveRequest = {
  id: string;
  employeeId: string;
  type: LeaveType;
  startDate: Date;
  endDate: Date;
  status: LeaveRequestStatus;
  approvedById: string | null;
  createdAt: Date;
};

export type CashAdvanceStatus =
  | "pending"
  | "approved"
  | "released"
  | "partially_recovered"
  | "fully_recovered";

export type CashAdvance = {
  id: string;
  employeeId: string;
  amount: number;
  fundSourceId: string;
  isProjectLinked: boolean;
  projectId: string | null;
  purpose: string;
  status: CashAdvanceStatus;
  approvedById: string | null;
  releasedAt: Date | null;
  createdAt: Date;
};

export type CashAdvanceRecovery = {
  id: string;
  cashAdvanceId: string;
  payrollId: string;
  amountDeducted: number;
  remainingBalance: number;
  createdAt: Date;
};

export type PayrollStatus = "draft" | "approved" | "released";

export type Payroll = {
  id: string;
  periodStart: Date;
  periodEnd: Date;
  status: PayrollStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type PayslipDeduction = {
  label: string;
  amount: number;
};

export type PayslipAddition = {
  label: string;
  amount: number;
};

export type PayslipCashAdvanceDeduction = {
  cashAdvanceId: string;
  amount: number;
};

export type Payslip = {
  id: string;
  payrollId: string;
  employeeId: string;
  basicPay: number;
  deductions: PayslipDeduction[];
  additions: PayslipAddition[];
  cashAdvanceDeductions: PayslipCashAdvanceDeduction[];
  netPay: number;
  fundSourceId: string;
  createdAt: Date;
};
