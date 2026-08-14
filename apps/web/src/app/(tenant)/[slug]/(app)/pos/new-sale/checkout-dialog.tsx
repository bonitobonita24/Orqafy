"use client";

// Checkout dialog — re-grafted from starter/restropos right-panel/checkout-dialog.tsx
// chrome (order-summary card + payment-method grid), rewired to OUR 5 tenders
// (cash/gcash/maya/card/credit) and OUR cash-tendered/change math (lib/pos-cart.ts).
// Reference (interaction ONLY, not imported): starter/restropos/src/views/apps/pos/right-panel/checkout-dialog.tsx

import type { ElementType } from "react";
import { Banknote, CreditCard, Receipt, Smartphone, Wallet } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { PAYMENT_METHODS, formatCurrency, type CartTotals, type PaymentMethod } from "@/lib/pos-cart";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  gcash: "GCash",
  maya: "Maya",
  card: "Card",
  credit: "Credit",
};

const PAYMENT_ICONS: Record<PaymentMethod, ElementType> = {
  cash: Banknote,
  gcash: Smartphone,
  maya: Wallet,
  card: CreditCard,
  credit: Receipt,
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemCount: number;
  totals: CartTotals;
  paymentMethod: PaymentMethod;
  onPaymentMethodChange: (m: PaymentMethod) => void;
  amountPaid: number;
  onAmountPaidChange: (n: number) => void;
  change: number;
  notes: string;
  onNotesChange: (s: string) => void;
  canCheckout: boolean;
  reason: string | null;
  isPending: boolean;
  onConfirm: () => void;
}

export function CheckoutDialog({
  open,
  onOpenChange,
  itemCount,
  totals,
  paymentMethod,
  onPaymentMethodChange,
  amountPaid,
  onAmountPaidChange,
  change,
  notes,
  onNotesChange,
  canCheckout,
  reason,
  isPending,
  onConfirm,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Confirm Payment</DialogTitle>
        </DialogHeader>

        <div className="rounded-xl bg-muted p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold">
                {itemCount} item{itemCount === 1 ? "" : "s"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">Ready to check out</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Amount Due
              </p>
              <p className="text-2xl font-bold">{formatCurrency(totals.totalAmount)}</p>
            </div>
          </div>

          <Separator className="my-3" />

          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax</span>
              <span>{formatCurrency(totals.taxAmount)}</span>
            </div>
            {totals.discountAmount > 0 && (
              <div className="flex justify-between text-primary">
                <span>Discount</span>
                <span>− {formatCurrency(totals.discountAmount)}</span>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2.5">
          <p className="text-sm font-medium">Payment method</p>
          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_METHODS.map((method) => {
              const Icon = PAYMENT_ICONS[method];
              const isSelected = paymentMethod === method;
              return (
                <button
                  key={method}
                  type="button"
                  onClick={() => onPaymentMethodChange(method)}
                  className={cn(
                    "flex h-11 items-center gap-2.5 rounded-md border border-border px-4 text-sm font-medium transition-colors",
                    isSelected ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {PAYMENT_METHOD_LABELS[method]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs">
            <span className="block text-muted-foreground">Amount Paid</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amountPaid}
              onChange={(e) => onAmountPaidChange(Number(e.target.value) || 0)}
              className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-right text-sm"
            />
          </label>
          {paymentMethod === "cash" && (
            <div className="text-xs">
              <span className="block text-muted-foreground">Change</span>
              <p className="mt-1 rounded-md bg-muted px-2 py-1.5 text-right text-sm font-semibold">
                {formatCurrency(change)}
              </p>
            </div>
          )}
        </div>

        <label className="block text-xs">
          <span className="block text-muted-foreground">Notes</span>
          <textarea
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          />
        </label>

        {reason !== null && <p className="text-xs text-destructive">{reason}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!canCheckout || isPending} onClick={onConfirm}>
            {isPending ? "Processing…" : `Confirm · ${formatCurrency(totals.totalAmount)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
