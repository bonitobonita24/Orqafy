import { describe, it, expect } from "vitest";
import { serializeTaskForPull, serializePayslipForPull } from "../pull";

describe("serializeTaskForPull", () => {
  const task = {
    id: "task-1",
    tenantId: "tenant-1",
    title: "Fix the pump",
    description: "North wellhead",
    status: "in_progress",
    priority: "high",
    dueDate: new Date("2026-08-01T00:00:00.000Z"),
    projectId: "proj-1",
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-15T00:00:00.000Z"),
  };

  it("maps server fields onto the mobile column shape", () => {
    expect(serializeTaskForPull(task, "user-1")).toEqual({
      server_id: "task-1",
      tenant_id: "tenant-1",
      title: "Fix the pump",
      description: "North wellhead",
      status: "in_progress",
      priority: "high",
      assigned_to: "user-1",
      due_date: Date.UTC(2026, 7, 1),
      project_id: "proj-1",
      created_at: Date.UTC(2026, 6, 1),
      updated_at: Date.UTC(2026, 6, 15),
      synced: true,
    });
  });

  it("passes through a null dueDate", () => {
    const result = serializeTaskForPull({ ...task, dueDate: null }, "user-1");
    expect(result.due_date).toBeNull();
  });
});

describe("serializePayslipForPull", () => {
  const payslip = {
    id: "slip-1",
    tenantId: "tenant-1",
    grossPay: { toNumber: () => 50000, toFixed: (n: number) => (50000).toFixed(n) },
    netPay: { toNumber: () => 42000, toFixed: (n: number) => (42000).toFixed(n) },
    totalDeductions: { toNumber: () => 8000, toFixed: (n: number) => (8000).toFixed(n) },
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-02T00:00:00.000Z"),
    payroll: {
      periodStart: new Date("2026-06-01T00:00:00.000Z"),
      periodEnd: new Date("2026-06-15T00:00:00.000Z"),
    },
  };

  it("maps the period from the joined payroll and stringifies deductions", () => {
    expect(serializePayslipForPull(payslip, "user-1")).toEqual({
      server_id: "slip-1",
      tenant_id: "tenant-1",
      user_id: "user-1",
      period_start: Date.UTC(2026, 5, 1),
      period_end: Date.UTC(2026, 5, 15),
      gross_pay: 50000,
      net_pay: 42000,
      deductions: "8000.00",
      created_at: Date.UTC(2026, 6, 1),
      updated_at: Date.UTC(2026, 6, 2),
    });
  });

  it("emits deductions as a parseFloat-able string (the mobile screen calls parseFloat)", () => {
    const result = serializePayslipForPull(payslip, "user-1");
    expect(Number.isNaN(parseFloat(result.deductions))).toBe(false);
    expect(parseFloat(result.deductions)).toBe(8000);
  });
});
