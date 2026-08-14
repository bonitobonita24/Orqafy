"use client";

import { useState } from "react";
import Link from "next/link";
import { ShoppingCart, Trash2 } from "@/components/ui/icons";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useCart } from "@/lib/cart-store";
import { formatCurrency } from "@/lib/quotation-build";

export function CartDrawer(): React.ReactNode {
  const { state, itemCount, subtotal, removeItem, setQuantity, hydrated, tenantSlug } =
    useCart();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="relative flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium transition hover:bg-accent"
          aria-label={`Open cart (${itemCount} items)`}
        >
          <ShoppingCart className="h-4 w-4" />
          <span>Cart</span>
          {hydrated && itemCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-semibold text-black">
              {itemCount}
            </span>
          ) : null}
        </button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col gap-6 p-6 sm:max-w-md">
        <SheetHeader className="p-0">
          <SheetTitle className="text-2xl">Your cart</SheetTitle>
          <SheetDescription>
            {hydrated && itemCount > 0
              ? `${itemCount} item${itemCount === 1 ? "" : "s"}`
              : "Your cart is empty."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col overflow-y-auto">
          {!hydrated ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Loading…
            </p>
          ) : state.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-lg font-medium text-muted-foreground">
                Your cart is empty
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Add products to start shopping.
              </p>
            </div>
          ) : (
            state.items.map((item) => (
              <div
                key={item.productId}
                className="flex items-start gap-4 border-b border-border py-4 last:border-b-0"
              >
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                  {item.imageUrl !== null && item.imageUrl !== undefined ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <ShoppingCart className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <h4 className="truncate text-sm font-medium">{item.name}</h4>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(item.price)} each
                  </p>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={item.quantity}
                    onChange={(e) => {
                      const next = Number.parseInt(e.target.value, 10);
                      setQuantity(
                        item.productId,
                        Number.isFinite(next) && next > 0 ? next : 1,
                      );
                    }}
                    className="w-20 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs shadow-none"
                    aria-label={`Quantity for ${item.name}`}
                  />
                </div>
                <div className="flex flex-col items-end gap-3">
                  <span className="text-sm font-semibold">
                    {formatCurrency(item.price * item.quantity)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      removeItem(item.productId);
                    }}
                    aria-label={`Remove ${item.name}`}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground transition group-hover:text-destructive" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <SheetFooter className="flex flex-col gap-2 p-0 sm:flex-col sm:space-x-0">
          <div className="flex items-center justify-between gap-2.5">
            <p className="text-muted-foreground">Subtotal</p>
            <p className="text-lg font-semibold">{formatCurrency(subtotal)}</p>
          </div>
          <Separator />
          <div className="mt-2 flex flex-col gap-2">
            <Button asChild size="lg" className="w-full rounded-lg">
              <Link
                href={`/${tenantSlug}/store/checkout`}
                onClick={() => {
                  setOpen(false);
                }}
                aria-disabled={!hydrated || state.items.length === 0}
                className={
                  !hydrated || state.items.length === 0
                    ? "pointer-events-none opacity-50"
                    : ""
                }
              >
                Checkout
              </Link>
            </Button>
            <Button
              type="button"
              size="lg"
              variant="outline"
              className="w-full rounded-lg"
              onClick={() => {
                setOpen(false);
              }}
            >
              Continue Shopping
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
