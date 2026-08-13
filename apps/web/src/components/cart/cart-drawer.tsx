"use client";

import { useState } from "react";
import Link from "next/link";
import { ShoppingCart, Trash2 } from "@/components/ui/icons";

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
      <SheetContent className="flex w-full flex-col gap-4 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Your cart</SheetTitle>
          <SheetDescription>
            {hydrated && itemCount > 0
              ? `${itemCount} item${itemCount === 1 ? "" : "s"}`
              : "Your cart is empty."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {!hydrated ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Loading…
            </p>
          ) : state.items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Add products to start shopping.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {state.items.map((item) => (
                <li
                  key={item.productId}
                  className="flex items-start gap-3 py-3"
                >
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
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
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(item.price)} each
                    </p>
                    <div className="mt-1 flex items-center gap-2">
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
                        className="w-16 rounded-md border border-input bg-background px-2 py-1 text-xs"
                        aria-label={`Quantity for ${item.name}`}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          removeItem(item.productId);
                        }}
                        className="text-muted-foreground transition hover:text-destructive"
                        aria-label={`Remove ${item.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm font-semibold">
                    {formatCurrency(item.price * item.quantity)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <SheetFooter className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-col sm:space-x-0">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-semibold">{formatCurrency(subtotal)}</span>
          </div>
          <Link
            href={`/${tenantSlug}/store/checkout`}
            onClick={() => {
              setOpen(false);
            }}
            aria-disabled={!hydrated || state.items.length === 0}
            className={`w-full rounded-md border border-primary/40 bg-primary/10 px-4 py-3 text-center text-sm font-medium text-primary transition hover:bg-primary/20 ${
              !hydrated || state.items.length === 0
                ? "pointer-events-none opacity-50"
                : ""
            }`}
          >
            Checkout
          </Link>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
