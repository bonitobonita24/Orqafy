// Pure helpers mirroring server-side quotation math (apps/web/src/server/trpc/routers/crm.ts).
// Server locks subtotal = Σ(quantity × baseCost) at create time. Marked-up prices per column
// are presentation data — client computes and submits them; server stores as-is.
// useCeiling on a markup column rounds the per-line marked-up price up to the next whole peso.

export const MARKUP_TIERS = ["tier1", "tier2", "tier3"] as const;
export type MarkupTier = (typeof MARKUP_TIERS)[number];

export interface DraftMarkup {
  markupColumnIndex: number;
  markedUpPrice: number;
}

export interface DraftLineItem {
  productId?: string;
  description: string;
  unit: string;
  quantity: number;
  baseCost: number;
  sortOrder: number;
  markups: DraftMarkup[];
}

export interface DraftSection {
  name: string;
  description?: string;
  sortOrder: number;
  lineItems: DraftLineItem[];
}

export interface DraftMarkupColumn {
  name: string;
  tier: MarkupTier;
  percentage: number;
  useCeiling: boolean;
  sortOrder: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeLineItemTotal(quantity: number, baseCost: number): number {
  return round2(quantity * baseCost);
}

export function computeMarkedUpPrice(
  baseCost: number,
  percentage: number,
  useCeiling: boolean,
): number {
  const pct = percentage < 0 ? 0 : percentage;
  const raw = baseCost * (1 + pct / 100);
  return useCeiling ? Math.ceil(raw) : round2(raw);
}

export function computeSectionSubtotal(section: DraftSection): number {
  return round2(
    section.lineItems.reduce((acc, li) => acc + li.quantity * li.baseCost, 0),
  );
}

export interface QuotationTotalsInput {
  sections: DraftSection[];
  taxAmount?: number;
}

export interface QuotationTotals {
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
}

export function computeQuotationTotals(input: QuotationTotalsInput): QuotationTotals {
  const subtotal = round2(
    input.sections.reduce((acc, s) => acc + computeSectionSubtotal(s), 0),
  );
  const taxAmount = input.taxAmount ?? 0;
  return {
    subtotal,
    taxAmount,
    totalAmount: round2(subtotal + taxAmount),
  };
}

export interface ValidationInput {
  customerId: string;
  title: string;
  sections: DraftSection[];
}

export type ValidationResult = { ok: true } | { ok: false; reason: string };

export function validateQuotationDraft(input: ValidationInput): ValidationResult {
  if (!input.title.trim()) return { ok: false, reason: "Title is required." };
  if (!input.customerId.trim()) {
    return { ok: false, reason: "Customer is required." };
  }
  if (input.sections.length === 0) {
    return { ok: false, reason: "At least one section is required." };
  }
  for (const section of input.sections) {
    if (section.lineItems.length === 0) {
      return {
        ok: false,
        reason: `Section "${section.name || "(unnamed)"}" needs at least one line item.`,
      };
    }
    for (const li of section.lineItems) {
      if (!li.description.trim()) {
        return { ok: false, reason: "Every line item needs a description." };
      }
      if (li.quantity <= 0) {
        return { ok: false, reason: "Line item quantity must be greater than zero." };
      }
      if (li.baseCost < 0) {
        return { ok: false, reason: "Line item base cost cannot be negative." };
      }
    }
  }
  return { ok: true };
}

export function formatCurrency(amount: number, currency = "PHP"): string {
  try {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}
