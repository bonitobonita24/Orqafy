import { describe, expect, it } from "vitest";
import {
  computeLineItemTotal,
  computeMarkedUpPrice,
  computeSectionSubtotal,
  computeQuotationTotals,
  formatCurrency,
  validateQuotationDraft,
  type DraftLineItem,
  type DraftSection,
} from "../quotation-build";

const baseLineItem = (overrides: Partial<DraftLineItem> = {}): DraftLineItem => ({
  description: "Widget",
  unit: "pcs",
  quantity: 1,
  baseCost: 100,
  sortOrder: 0,
  markups: [],
  ...overrides,
});

const baseSection = (overrides: Partial<DraftSection> = {}): DraftSection => ({
  name: "Default",
  sortOrder: 0,
  lineItems: [baseLineItem()],
  ...overrides,
});

describe("computeLineItemTotal", () => {
  it("returns quantity × baseCost", () => {
    expect(computeLineItemTotal(3, 50)).toBe(150);
  });

  it("returns 0 when quantity is 0", () => {
    expect(computeLineItemTotal(0, 100)).toBe(0);
  });

  it("rounds to two decimals to avoid float drift", () => {
    expect(computeLineItemTotal(3, 33.33)).toBeCloseTo(99.99, 2);
  });
});

describe("computeMarkedUpPrice", () => {
  it("applies percentage markup with no ceiling", () => {
    expect(computeMarkedUpPrice(100, 20, false)).toBe(120);
  });

  it("preserves fractional cents without ceiling", () => {
    expect(computeMarkedUpPrice(100, 22.5, false)).toBeCloseTo(122.5, 2);
  });

  it("ceils to whole peso when useCeiling=true", () => {
    expect(computeMarkedUpPrice(100, 22.5, true)).toBe(123);
  });

  it("returns base cost when percentage is 0", () => {
    expect(computeMarkedUpPrice(100, 0, false)).toBe(100);
  });

  it("ceil on exact whole number is a no-op", () => {
    expect(computeMarkedUpPrice(100, 20, true)).toBe(120);
  });

  it("rejects negative percentage as identity (clamp)", () => {
    // Server zod validates nonnegative on input — helper should be tolerant.
    expect(computeMarkedUpPrice(100, -5, false)).toBe(100);
  });
});

describe("computeSectionSubtotal", () => {
  it("sums quantity × baseCost across line items", () => {
    const section = baseSection({
      lineItems: [
        baseLineItem({ quantity: 2, baseCost: 100 }),
        baseLineItem({ quantity: 3, baseCost: 50 }),
      ],
    });
    expect(computeSectionSubtotal(section)).toBe(350);
  });

  it("returns 0 for empty line items", () => {
    expect(computeSectionSubtotal(baseSection({ lineItems: [] }))).toBe(0);
  });
});

describe("computeQuotationTotals", () => {
  it("sums section subtotals and adds tax", () => {
    const sections: DraftSection[] = [
      baseSection({
        lineItems: [baseLineItem({ quantity: 1, baseCost: 1000 })],
      }),
      baseSection({
        name: "Add-ons",
        lineItems: [baseLineItem({ quantity: 2, baseCost: 250 })],
      }),
    ];
    const totals = computeQuotationTotals({ sections, taxAmount: 100 });
    expect(totals.subtotal).toBe(1500);
    expect(totals.totalAmount).toBe(1600);
  });

  it("returns zeros for empty sections", () => {
    expect(computeQuotationTotals({ sections: [], taxAmount: 0 })).toEqual({
      subtotal: 0,
      taxAmount: 0,
      totalAmount: 0,
    });
  });

  it("defaults taxAmount to 0", () => {
    const totals = computeQuotationTotals({
      sections: [baseSection({ lineItems: [baseLineItem({ baseCost: 100 })] })],
    });
    expect(totals.taxAmount).toBe(0);
    expect(totals.totalAmount).toBe(100);
  });
});

describe("validateQuotationDraft", () => {
  const baseInput = {
    customerId: "cust-1",
    title: "Q1 Sale",
    sections: [baseSection()],
  };

  it("accepts a complete minimal draft", () => {
    expect(validateQuotationDraft(baseInput)).toEqual({ ok: true });
  });

  it("rejects empty title", () => {
    const r = validateQuotationDraft({ ...baseInput, title: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/title/i);
  });

  it("rejects missing customer", () => {
    const r = validateQuotationDraft({ ...baseInput, customerId: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/customer/i);
  });

  it("rejects zero sections", () => {
    const r = validateQuotationDraft({ ...baseInput, sections: [] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/section/i);
  });

  it("rejects a section with no line items", () => {
    const r = validateQuotationDraft({
      ...baseInput,
      sections: [baseSection({ lineItems: [] })],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/line item/i);
  });

  it("rejects a line item with zero quantity", () => {
    const r = validateQuotationDraft({
      ...baseInput,
      sections: [baseSection({ lineItems: [baseLineItem({ quantity: 0 })] })],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/quantity/i);
  });

  it("rejects a line item with negative baseCost", () => {
    const r = validateQuotationDraft({
      ...baseInput,
      sections: [baseSection({ lineItems: [baseLineItem({ baseCost: -1 })] })],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/cost/i);
  });

  it("rejects a line item with empty description", () => {
    const r = validateQuotationDraft({
      ...baseInput,
      sections: [baseSection({ lineItems: [baseLineItem({ description: "" })] })],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/description/i);
  });
});

describe("formatCurrency", () => {
  it("formats PHP by default", () => {
    expect(formatCurrency(1234.5)).toMatch(/1,234\.50/);
  });

  it("respects alternate currency", () => {
    expect(formatCurrency(1234.5, "USD")).toMatch(/1,234\.50/);
  });

  it("renders zero", () => {
    expect(formatCurrency(0)).toMatch(/0\.00/);
  });
});
