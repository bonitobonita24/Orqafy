"use client";

// Receipt dialog — adapted from starter/restropos right-panel/kot-dialog.tsx
// (dropped covers/table, kept the printable-window pattern), rewired to a
// post-sale receipt over OUR PosSale shape (5 tenders, tax/discount, change).
// Reference (interaction ONLY, not imported): starter/restropos/src/views/apps/pos/right-panel/kot-dialog.tsx

import { useRef } from "react";
import { Printer, ReceiptText } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, type CartLineItem, type PaymentMethod } from "@/lib/pos-cart";
import { PAYMENT_METHOD_LABELS } from "./checkout-dialog";

export interface ReceiptSale {
  saleNumber: string;
  createdAt: string;
  items: CartLineItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  amountPaid: number;
  changeAmount: number;
  paymentMethod: PaymentMethod;
}

interface Props {
  sale: ReceiptSale | null;
  onClose: () => void;
}

export function ReceiptDialog({ sale, onClose }: Props) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (!printRef.current) return;
    const content = printRef.current.innerHTML;
    const win = window.open("", "_blank", "width=380,height=600");
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>Receipt ${sale?.saleNumber ?? ""}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: monospace; font-size: 13px; padding: 12px; }
            .receipt-print { max-width: 320px; margin: 0 auto; }
          </style>
        </head>
        <body><div class="receipt-print">${content}</div></body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  if (!sale) return null;

  return (
    <Dialog open={sale !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <ReceiptText className="size-4 text-primary" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base">Sale Complete</DialogTitle>
              <p className="text-sm text-muted-foreground">
                {new Date(sale.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Printable receipt area */}
        <div ref={printRef} className="space-y-4">
          <p className="text-2xl font-bold tracking-tight">{sale.saleNumber}</p>

          <Separator className="border-dashed" />

          <div className="space-y-3">
            {sale.items.map((item) => (
              <div key={item.productId} className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                      {item.quantity}×
                    </span>
                    <span className="leading-snug font-medium">{item.description}</span>
                  </div>
                </div>
                <span className="shrink-0 text-sm tabular-nums">
                  {formatCurrency(item.quantity * item.unitPrice)}
                </span>
              </div>
            ))}
          </div>

          <Separator className="border-dashed" />

          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(sale.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax</span>
              <span>{formatCurrency(sale.taxAmount)}</span>
            </div>
            {sale.discountAmount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Discount</span>
                <span>− {formatCurrency(sale.discountAmount)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between text-base font-bold">
              <span>Total</span>
              <span>{formatCurrency(sale.totalAmount)}</span>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm">
            <span className="text-muted-foreground">Paid via</span>
            <span className="font-semibold">{PAYMENT_METHOD_LABELS[sale.paymentMethod]}</span>
          </div>
          {sale.paymentMethod === "cash" && (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Amount paid / Change</span>
              <span className="tabular-nums">
                {formatCurrency(sale.amountPaid)} / {formatCurrency(sale.changeAmount)}
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handlePrint}>
            <Printer />
            Print Receipt
          </Button>
          <Button onClick={onClose}>New Sale</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
