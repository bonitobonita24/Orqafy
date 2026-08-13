// Pure POS cart math + state helpers.
// Used by apps/web/src/app/(tenant)/[slug]/(app)/pos/new-sale/cart-client.tsx
// and unit-tested directly without React. Mirrors the server-side validation
// rules in apps/web/src/server/trpc/routers/pos.ts sale.create so the client
// blocks invalid submissions before they round-trip.

export type PaymentMethod = "cash" | "gcash" | "maya" | "card" | "credit";

export const PAYMENT_METHODS: ReadonlyArray<PaymentMethod> = [
  "cash",
  "gcash",
  "maya",
  "card",
  "credit",
];

export interface CartLineItem {
  productId: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
}

export interface CartTotals {
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
}

export interface CartValidationState {
  hasSession: boolean;
  hasItems: boolean;
  totalNonNegative: boolean;
  amountPaidSufficient: boolean;
  exactAmountForNonCash: boolean;
  canCheckout: boolean;
  reason: string | null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeCartTotals(
  items: ReadonlyArray<CartLineItem>,
  options: { taxAmount?: number; discountAmount?: number } = {},
): CartTotals {
  const subtotal = round2(
    items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0),
  );
  const taxAmount = round2(Math.max(0, options.taxAmount ?? 0));
  const discountAmount = round2(Math.max(0, options.discountAmount ?? 0));
  const totalAmount = round2(subtotal + taxAmount - discountAmount);
  return { subtotal, taxAmount, discountAmount, totalAmount };
}

export function computeChange(
  totalAmount: number,
  amountPaid: number,
  paymentMethod: PaymentMethod,
): number {
  if (paymentMethod !== "cash") return 0;
  return round2(Math.max(0, amountPaid - totalAmount));
}

export function validateCart(args: {
  items: ReadonlyArray<CartLineItem>;
  amountPaid: number;
  paymentMethod: PaymentMethod;
  totals: CartTotals;
  sessionId: string | null;
}): CartValidationState {
  const { items, amountPaid, paymentMethod, totals, sessionId } = args;
  const hasSession = sessionId !== null && sessionId.length > 0;
  const hasItems = items.length > 0;
  const totalNonNegative = totals.totalAmount >= 0;
  const amountPaidSufficient = amountPaid >= totals.totalAmount;
  const exactAmountForNonCash =
    paymentMethod === "cash" || amountPaid === totals.totalAmount;

  let reason: string | null = null;
  if (!hasSession) reason = "Select an open session to ring-3 against.";
  else if (!hasItems) reason = "Add at least one product to the cart.";
  else if (!totalNonNegative) reason = "Discount cannot exceed subtotal + tax.";
  else if (!amountPaidSufficient) reason = "Amount paid is less than the total due.";
  else if (!exactAmountForNonCash)
    reason = "Non-cash payments must equal the total exactly.";

  return {
    hasSession,
    hasItems,
    totalNonNegative,
    amountPaidSufficient,
    exactAmountForNonCash,
    canCheckout:
      hasSession &&
      hasItems &&
      totalNonNegative &&
      amountPaidSufficient &&
      exactAmountForNonCash,
    reason,
  };
}

export function addOrIncrementItem(
  items: ReadonlyArray<CartLineItem>,
  newItem: CartLineItem,
): CartLineItem[] {
  const existingIdx = items.findIndex((i) => i.productId === newItem.productId);
  if (existingIdx === -1) return [...items, newItem];
  return items.map((i, idx) =>
    idx === existingIdx ? { ...i, quantity: i.quantity + newItem.quantity } : i,
  );
}

export function setQuantity(
  items: ReadonlyArray<CartLineItem>,
  productId: string,
  quantity: number,
): CartLineItem[] {
  if (quantity <= 0) return items.filter((i) => i.productId !== productId);
  return items.map((i) =>
    i.productId === productId ? { ...i, quantity } : i,
  );
}

export function removeItem(
  items: ReadonlyArray<CartLineItem>,
  productId: string,
): CartLineItem[] {
  return items.filter((i) => i.productId !== productId);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(amount);
}
