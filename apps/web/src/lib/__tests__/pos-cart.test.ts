import { describe, it, expect } from "vitest";
import {
  addOrIncrementItem,
  computeCartTotals,
  computeChange,
  formatCurrency,
  removeItem,
  setQuantity,
  validateCart,
  type CartLineItem,
} from "../pos-cart";

const PROD_A = "ck1234567890123456789012a";
const PROD_B = "ck1234567890123456789012b";
const SESSION_ID = "ck1234567890123456789012c";

function lineItem(overrides: Partial<CartLineItem> = {}): CartLineItem {
  return {
    productId: PROD_A,
    description: "Mouse",
    unit: "pcs",
    quantity: 1,
    unitPrice: 500,
    ...overrides,
  };
}

describe("computeCartTotals", () => {
  it("returns zero totals for an empty cart", () => {
    expect(computeCartTotals([])).toEqual({
      subtotal: 0,
      taxAmount: 0,
      discountAmount: 0,
      totalAmount: 0,
    });
  });

  it("sums quantity × unitPrice across line items", () => {
    const totals = computeCartTotals([
      lineItem({ productId: PROD_A, quantity: 2, unitPrice: 500 }),
      lineItem({ productId: PROD_B, quantity: 1, unitPrice: 500 }),
    ]);
    expect(totals.subtotal).toBe(1500);
    expect(totals.totalAmount).toBe(1500);
  });

  it("applies tax and discount: total = subtotal + tax − discount", () => {
    const totals = computeCartTotals(
      [lineItem({ quantity: 2, unitPrice: 500 })],
      { taxAmount: 120, discountAmount: 50 },
    );
    expect(totals.subtotal).toBe(1000);
    expect(totals.taxAmount).toBe(120);
    expect(totals.discountAmount).toBe(50);
    expect(totals.totalAmount).toBe(1070);
  });

  it("rounds to 2 decimals (no floating point drift)", () => {
    const totals = computeCartTotals([
      lineItem({ quantity: 3, unitPrice: 0.1 }),
    ]);
    expect(totals.subtotal).toBe(0.3);
  });

  it("clamps negative tax/discount inputs to zero", () => {
    const totals = computeCartTotals([lineItem()], {
      taxAmount: -10,
      discountAmount: -5,
    });
    expect(totals.taxAmount).toBe(0);
    expect(totals.discountAmount).toBe(0);
  });
});

describe("computeChange", () => {
  it("returns amountPaid − totalAmount for cash sales", () => {
    expect(computeChange(1500, 2000, "cash")).toBe(500);
  });

  it("returns zero for non-cash payments even when overpaid", () => {
    expect(computeChange(500, 600, "gcash")).toBe(0);
    expect(computeChange(500, 500, "card")).toBe(0);
  });

  it("never returns negative change (clamps at zero)", () => {
    expect(computeChange(1500, 100, "cash")).toBe(0);
  });
});

describe("validateCart", () => {
  function makeArgs(overrides: Partial<Parameters<typeof validateCart>[0]> = {}) {
    const items: CartLineItem[] =
      overrides.items === undefined
        ? [lineItem({ quantity: 1, unitPrice: 500 })]
        : [...overrides.items];
    const totals = computeCartTotals(items);
    return {
      items,
      amountPaid: 500,
      paymentMethod: "cash" as const,
      totals,
      sessionId: SESSION_ID,
      ...overrides,
      // recompute totals if items was overridden but totals wasn't
      ...(overrides.totals === undefined ? { totals } : {}),
    };
  }

  it("canCheckout is true for a valid happy-path cart", () => {
    const v = validateCart(makeArgs());
    expect(v.canCheckout).toBe(true);
    expect(v.reason).toBeNull();
  });

  it("blocks checkout when no session selected", () => {
    const v = validateCart(makeArgs({ sessionId: null }));
    expect(v.canCheckout).toBe(false);
    expect(v.hasSession).toBe(false);
    expect(v.reason).toMatch(/session/i);
  });

  it("blocks checkout when cart is empty", () => {
    const v = validateCart(makeArgs({ items: [] }));
    expect(v.canCheckout).toBe(false);
    expect(v.hasItems).toBe(false);
    expect(v.reason).toMatch(/product/i);
  });

  it("blocks checkout when amountPaid is below total", () => {
    const v = validateCart(makeArgs({ amountPaid: 100 }));
    expect(v.canCheckout).toBe(false);
    expect(v.amountPaidSufficient).toBe(false);
    expect(v.reason).toMatch(/amount paid/i);
  });

  it("blocks non-cash payments that differ from total", () => {
    const v = validateCart(
      makeArgs({ amountPaid: 600, paymentMethod: "gcash" }),
    );
    expect(v.canCheckout).toBe(false);
    expect(v.exactAmountForNonCash).toBe(false);
    expect(v.reason).toMatch(/non-cash/i);
  });

  it("allows non-cash payments that match the total exactly", () => {
    const v = validateCart(
      makeArgs({ amountPaid: 500, paymentMethod: "gcash" }),
    );
    expect(v.canCheckout).toBe(true);
  });

  it("blocks checkout when discount drives total negative", () => {
    const items = [lineItem({ quantity: 1, unitPrice: 100 })];
    const totals = computeCartTotals(items, { discountAmount: 9999 });
    const v = validateCart({
      items,
      amountPaid: 0,
      paymentMethod: "cash",
      totals,
      sessionId: SESSION_ID,
    });
    expect(v.totalNonNegative).toBe(false);
    expect(v.canCheckout).toBe(false);
    expect(v.reason).toMatch(/discount/i);
  });
});

describe("cart mutations", () => {
  it("addOrIncrementItem appends a new product", () => {
    const result = addOrIncrementItem(
      [lineItem({ productId: PROD_A, quantity: 1 })],
      lineItem({ productId: PROD_B, quantity: 1 }),
    );
    expect(result).toHaveLength(2);
    expect(result[1]?.productId).toBe(PROD_B);
  });

  it("addOrIncrementItem increments quantity for an existing product", () => {
    const result = addOrIncrementItem(
      [lineItem({ productId: PROD_A, quantity: 2 })],
      lineItem({ productId: PROD_A, quantity: 3 }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.quantity).toBe(5);
  });

  it("setQuantity updates only the targeted line", () => {
    const result = setQuantity(
      [
        lineItem({ productId: PROD_A, quantity: 1 }),
        lineItem({ productId: PROD_B, quantity: 1 }),
      ],
      PROD_A,
      7,
    );
    expect(result.find((i) => i.productId === PROD_A)?.quantity).toBe(7);
    expect(result.find((i) => i.productId === PROD_B)?.quantity).toBe(1);
  });

  it("setQuantity ≤ 0 removes the line item", () => {
    const result = setQuantity(
      [lineItem({ productId: PROD_A, quantity: 5 })],
      PROD_A,
      0,
    );
    expect(result).toHaveLength(0);
  });

  it("removeItem drops the matching productId", () => {
    const result = removeItem(
      [
        lineItem({ productId: PROD_A, quantity: 1 }),
        lineItem({ productId: PROD_B, quantity: 1 }),
      ],
      PROD_A,
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.productId).toBe(PROD_B);
  });

  it("mutations do not mutate the input array (immutability)", () => {
    const original = [lineItem({ productId: PROD_A, quantity: 1 })];
    const frozen = Object.freeze([...original]);
    addOrIncrementItem(frozen, lineItem({ productId: PROD_B }));
    setQuantity(frozen, PROD_A, 5);
    removeItem(frozen, PROD_A);
    expect(original).toEqual([
      lineItem({ productId: PROD_A, quantity: 1 }),
    ]);
  });
});

describe("formatCurrency", () => {
  it("formats PHP currency with 2 decimals", () => {
    const formatted = formatCurrency(1500);
    // Intl output is locale/platform-dependent — assert structural pieces
    expect(formatted).toContain("1,500.00");
    expect(formatted).toMatch(/(₱|PHP)/);
  });
});
