import { describe, it, expect } from "vitest";
import {
  computeSss,
  computePhilhealth,
  computePagibig,
  computeWithholding,
  computePayslip,
  resolveRatesFromRows,
  DEFAULT_SSS_2025,
} from "@/server/lib/payroll-compute";

describe("PH statutory computation (DECISIONS_LOG §C, 2025 cited defaults)", () => {
  describe("SSS", () => {
    it("computes EE 5% / ER 10% of MSC within band", () => {
      const r = computeSss(20000);
      expect(r.employee).toBe(1000); // 5% of 20,000
      expect(r.employer).toBe(2000); // 10% of 20,000
    });
    it("clamps to MSC floor (₱5,000)", () => {
      const r = computeSss(3000);
      expect(r.employee).toBe(250); // 5% of floor 5,000
    });
    it("clamps to MSC ceiling (₱35,000)", () => {
      const r = computeSss(60000);
      expect(r.employee).toBe(1750); // 5% of ceiling 35,000
    });
  });

  describe("PhilHealth", () => {
    it("computes EE 2.5% of basic within band", () => {
      expect(computePhilhealth(40000).employee).toBe(1000); // 2.5% of 40,000
    });
    it("applies floor ₱10,000 and ceiling ₱100,000", () => {
      expect(computePhilhealth(5000).employee).toBe(250); // floor
      expect(computePhilhealth(200000).employee).toBe(2500); // ceiling
    });
  });

  describe("Pag-IBIG", () => {
    it("caps at compensation ₱10,000 → max EE ₱200", () => {
      expect(computePagibig(50000).employee).toBe(200);
      expect(computePagibig(8000).employee).toBe(160);
    });
  });

  describe("BIR withholding (monthly TRAIN table)", () => {
    it("exempts compensation ≤ ₱20,833", () => {
      expect(computeWithholding(20000)).toBe(0);
    });
    it("applies 15% marginal in the second bracket", () => {
      // 25,000 taxable → (25,000 − 20,833) * 15% = 625.05
      expect(computeWithholding(25000)).toBeCloseTo(625.05, 1);
    });
    it("applies 20% bracket base + marginal", () => {
      // 40,000 → 1,875 + (40,000 − 33,333) * 20% = 1,875 + 1,333.4 = 3,208.4
      expect(computeWithholding(40000)).toBeCloseTo(3208.4, 1);
    });
  });

  describe("computePayslip aggregate", () => {
    it("derives gross → statutory → net with employer shares tracked separately", () => {
      const r = computePayslip({ basicPay: 30000, allowances: 2000 });
      expect(r.grossPay).toBe(32000);
      expect(r.sssDeduction).toBe(1500); // 5% of 30,000
      expect(r.philhealthDeduction).toBe(750); // 2.5% of 30,000
      expect(r.pagibigDeduction).toBe(200); // capped
      // employer shares are NOT part of employee deductions
      expect(r.sssEmployerShare).toBe(3000);
      expect(r.netPay).toBe(r.grossPay - r.totalDeductions);
      expect(r.totalDeductions).toBeGreaterThan(r.sssDeduction);
    });
    it("net never exceeds gross", () => {
      const r = computePayslip({ basicPay: 80000, overtimePay: 5000 });
      expect(r.netPay).toBeLessThan(r.grossPay);
      expect(r.netPay).toBeGreaterThan(0);
    });
  });

  describe("resolveRatesFromRows", () => {
    it("falls back to cited 2025 defaults when no rows configured", () => {
      const resolved = resolveRatesFromRows([]);
      expect(resolved.sss).toEqual(DEFAULT_SSS_2025);
    });
    it("prefers the most recent active effective row per type", () => {
      const custom = { totalRate: 0.14, employeeRate: 0.045, employerRate: 0.095, mscFloor: 4000, mscCeiling: 30000 };
      const resolved = resolveRatesFromRows([
        { type: "sss", config: DEFAULT_SSS_2025, effectiveFrom: "2024-01-01", isActive: true },
        { type: "sss", config: custom, effectiveFrom: "2025-06-01", isActive: true },
      ]);
      expect(resolved.sss).toEqual(custom);
    });
    it("ignores inactive rows", () => {
      const resolved = resolveRatesFromRows([
        { type: "sss", config: { totalRate: 9, employeeRate: 9, employerRate: 9, mscFloor: 0, mscCeiling: 0 }, effectiveFrom: "2099-01-01", isActive: false },
      ]);
      expect(resolved.sss).toEqual(DEFAULT_SSS_2025);
    });
  });
});
