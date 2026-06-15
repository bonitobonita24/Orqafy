/**
 * PH statutory payroll computation — DECISIONS_LOG §C.
 *
 * Pure functions: gross → statutory deductions (SSS / PhilHealth / Pag-IBIG /
 * BIR withholding) → net. Employer shares are tracked separately (employer cost,
 * NOT deducted from employee net).
 *
 * Rates are CONFIGURABLE per tenant via the `StatutoryRate` table. The constants
 * below are the cited 2025 defaults — they double as the SEED source and as a
 * safe fallback when a tenant has not configured a given rate. Statutory tables
 * change annually; owner MUST verify against the latest issuances.
 */

export type StatutoryRateType = "sss" | "philhealth" | "pagibig" | "withholding";

export interface SssConfig {
  /** Combined SSS contribution rate (EE+ER) as a fraction of MSC. 2025 = 15%. */
  totalRate: number;
  /** Employee share fraction of MSC. 2025 = 5%. */
  employeeRate: number;
  /** Employer share fraction of MSC. 2025 = 10%. */
  employerRate: number;
  /** Monthly Salary Credit floor / ceiling (incl. WISP/MPF above 20,000). */
  mscFloor: number;
  mscCeiling: number;
}

export interface PhilhealthConfig {
  /** Premium rate on monthly basic. 2024/2025 = 5%. */
  premiumRate: number;
  /** Employee share = half of premium. 2025 = 2.5%. */
  employeeRate: number;
  floor: number;
  ceiling: number;
}

export interface PagibigConfig {
  employeeRate: number; // 2%
  employerRate: number; // 2%
  /** Compensation cap for mandatory contribution. ₱10,000 → max EE ₱200. */
  compensationCap: number;
}

export interface WithholdingBracket {
  /** Lower bound of taxable compensation (inclusive) for this bracket. */
  lower: number;
  /** Base tax amount for the bracket. */
  baseTax: number;
  /** Marginal rate applied to (taxable − lower). */
  rate: number;
}

export interface WithholdingConfig {
  /** Pay frequency the brackets are denominated in. */
  frequency: "monthly" | "semi_monthly";
  brackets: WithholdingBracket[];
}

// ── Cited 2025 PH defaults ──────────────────────────────────────────────────

/** SSS Circular 2024-006 — contribution rate 15% eff. Jan 2025; MSC ₱5,000–₱35,000. */
export const DEFAULT_SSS_2025: SssConfig = {
  totalRate: 0.15,
  employeeRate: 0.05,
  employerRate: 0.1,
  mscFloor: 5000,
  mscCeiling: 35000,
};

/** Universal Health Care Act / PhilHealth Circular — 5% premium, ₱10,000–₱100,000 (2024/2025). */
export const DEFAULT_PHILHEALTH_2025: PhilhealthConfig = {
  premiumRate: 0.05,
  employeeRate: 0.025,
  floor: 10000,
  ceiling: 100000,
};

/** Pag-IBIG (HDMF Circular) — EE 2% / ER 2%, comp cap ₱10,000 → max EE ₱200. */
export const DEFAULT_PAGIBIG_2025: PagibigConfig = {
  employeeRate: 0.02,
  employerRate: 0.02,
  compensationCap: 10000,
};

/** BIR Revised Withholding Tax Table (TRAIN, eff. 2023+) — MONTHLY brackets. */
export const DEFAULT_WITHHOLDING_2025: WithholdingConfig = {
  frequency: "monthly",
  brackets: [
    { lower: 0, baseTax: 0, rate: 0 }, // ≤ ₱20,833 exempt
    { lower: 20833, baseTax: 0, rate: 0.15 },
    { lower: 33333, baseTax: 1875, rate: 0.2 },
    { lower: 66667, baseTax: 8541.8, rate: 0.25 },
    { lower: 166667, baseTax: 33541.8, rate: 0.3 },
    { lower: 666667, baseTax: 183541.8, rate: 0.35 },
  ],
};

export const DEFAULT_RATE_SOURCES: Record<StatutoryRateType, string> = {
  sss: "SSS Circular 2024-006 — 15% contribution rate eff. Jan 2025; MSC ₱5,000–₱35,000 (incl. WISP/MPF above ₱20,000)",
  philhealth:
    "PhilHealth (Universal Health Care Act) — 5% premium, salary floor ₱10,000 / ceiling ₱100,000 (2024/2025 schedule)",
  pagibig: "HDMF (Pag-IBIG) Circular — EE 2% / ER 2%, compensation cap ₱10,000 (max EE ₱200)",
  withholding: "BIR Revised Withholding Tax Table under RA 10963 (TRAIN), eff. Jan 2023 onward — monthly brackets",
};

export const DEFAULT_RATE_CONFIGS: Record<StatutoryRateType, unknown> = {
  sss: DEFAULT_SSS_2025,
  philhealth: DEFAULT_PHILHEALTH_2025,
  pagibig: DEFAULT_PAGIBIG_2025,
  withholding: DEFAULT_WITHHOLDING_2025,
};

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
const clamp = (n: number, lo: number, hi: number): number => Math.min(Math.max(n, lo), hi);

// ── Per-statutory computations ──────────────────────────────────────────────

export function computeSss(monthlyBasic: number, cfg: SssConfig = DEFAULT_SSS_2025) {
  const msc = clamp(monthlyBasic, cfg.mscFloor, cfg.mscCeiling);
  return {
    employee: round2(msc * cfg.employeeRate),
    employer: round2(msc * cfg.employerRate),
  };
}

export function computePhilhealth(monthlyBasic: number, cfg: PhilhealthConfig = DEFAULT_PHILHEALTH_2025) {
  const base = clamp(monthlyBasic, cfg.floor, cfg.ceiling);
  const premium = base * cfg.premiumRate;
  // EE and ER split the premium equally.
  const employee = round2(base * cfg.employeeRate);
  return { employee, employer: round2(premium - employee) };
}

export function computePagibig(monthlyBasic: number, cfg: PagibigConfig = DEFAULT_PAGIBIG_2025) {
  const base = Math.min(monthlyBasic, cfg.compensationCap);
  return {
    employee: round2(base * cfg.employeeRate),
    employer: round2(base * cfg.employerRate),
  };
}

/** BIR withholding on taxable compensation (gross less mandatory EE contributions). */
export function computeWithholding(
  taxableCompensation: number,
  cfg: WithholdingConfig = DEFAULT_WITHHOLDING_2025,
): number {
  if (taxableCompensation <= 0) return 0;
  const brackets = [...cfg.brackets].sort((a, b) => a.lower - b.lower);
  let applicable: WithholdingBracket = brackets[0] ?? { lower: 0, baseTax: 0, rate: 0 };
  for (const b of brackets) {
    if (taxableCompensation >= b.lower) applicable = b;
    else break;
  }
  return round2(applicable.baseTax + (taxableCompensation - applicable.lower) * applicable.rate);
}

// ── Aggregate payslip computation ───────────────────────────────────────────

export interface PayslipComputeInput {
  basicPay: number;
  overtimePay?: number;
  allowances?: number;
  /** Manual extra deductions carried through (recovery, other). */
  cashAdvanceDeduction?: number;
  otherDeductions?: number;
}

export interface ResolvedRates {
  sss?: SssConfig;
  philhealth?: PhilhealthConfig;
  pagibig?: PagibigConfig;
  withholding?: WithholdingConfig;
}

export interface PayslipComputeResult {
  grossPay: number;
  sssDeduction: number;
  philhealthDeduction: number;
  pagibigDeduction: number;
  taxDeduction: number;
  cashAdvanceDeduction: number;
  otherDeductions: number;
  totalDeductions: number;
  netPay: number;
  sssEmployerShare: number;
  philhealthEmployerShare: number;
  pagibigEmployerShare: number;
  /** Auditable breakdown stored in Payslip.deductionDetails. */
  breakdown: Record<string, unknown>;
}

export function computePayslip(
  input: PayslipComputeInput,
  rates: ResolvedRates = {},
): PayslipComputeResult {
  const basicPay = input.basicPay;
  const overtimePay = input.overtimePay ?? 0;
  const allowances = input.allowances ?? 0;
  const cashAdvanceDeduction = input.cashAdvanceDeduction ?? 0;
  const otherDeductions = input.otherDeductions ?? 0;

  const grossPay = round2(basicPay + overtimePay + allowances);

  // Statutory bases use monthly basic pay (per §C / PH practice).
  const sss = computeSss(basicPay, rates.sss);
  const philhealth = computePhilhealth(basicPay, rates.philhealth);
  const pagibig = computePagibig(basicPay, rates.pagibig);

  // Taxable compensation = gross less mandatory employee statutory contributions.
  const mandatoryEe = sss.employee + philhealth.employee + pagibig.employee;
  const taxableComp = grossPay - mandatoryEe;
  const taxDeduction = computeWithholding(taxableComp, rates.withholding);

  const totalDeductions = round2(
    sss.employee +
      philhealth.employee +
      pagibig.employee +
      taxDeduction +
      cashAdvanceDeduction +
      otherDeductions,
  );
  const netPay = round2(grossPay - totalDeductions);

  return {
    grossPay,
    sssDeduction: sss.employee,
    philhealthDeduction: philhealth.employee,
    pagibigDeduction: pagibig.employee,
    taxDeduction,
    cashAdvanceDeduction,
    otherDeductions,
    totalDeductions,
    netPay,
    sssEmployerShare: sss.employer,
    philhealthEmployerShare: philhealth.employer,
    pagibigEmployerShare: pagibig.employer,
    breakdown: {
      grossPay,
      taxableCompensation: round2(taxableComp),
      employee: {
        sss: sss.employee,
        philhealth: philhealth.employee,
        pagibig: pagibig.employee,
        withholding: taxDeduction,
        cashAdvance: cashAdvanceDeduction,
        other: otherDeductions,
      },
      employer: {
        sss: sss.employer,
        philhealth: philhealth.employer,
        pagibig: pagibig.employer,
      },
    },
  };
}

/**
 * Resolve a tenant's active StatutoryRate rows (most recent effective per type)
 * into a ResolvedRates object, falling back to cited 2025 defaults when unset.
 */
export function resolveRatesFromRows(
  rows: Array<{ type: string; config: unknown; effectiveFrom: Date | string; isActive: boolean }>,
): ResolvedRates {
  const pick = (type: StatutoryRateType) =>
    rows
      .filter((r) => r.type === type && r.isActive)
      .sort((a, b) => new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime())[0]?.config;
  return {
    sss: (pick("sss") as SssConfig) ?? DEFAULT_SSS_2025,
    philhealth: (pick("philhealth") as PhilhealthConfig) ?? DEFAULT_PHILHEALTH_2025,
    pagibig: (pick("pagibig") as PagibigConfig) ?? DEFAULT_PAGIBIG_2025,
    withholding: (pick("withholding") as WithholdingConfig) ?? DEFAULT_WITHHOLDING_2025,
  };
}
