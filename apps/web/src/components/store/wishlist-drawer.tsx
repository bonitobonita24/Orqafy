"use client";

import { useState } from "react";
import { Heart, Trash2 } from "@/components/ui/icons";

import { Button } from "@/components/ui/button";
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
import { useWishlist } from "@/lib/wishlist-store";
import { formatCurrency } from "@/lib/quotation-build";

/**
 * Wishlist drawer — mirrors `cart-drawer.tsx`'s Sheet idiom: a header trigger
 * opens a Sheet listing wishlisted items, each with a remove action and an
 * "Add to cart" action that hands the item straight to the cart store (T2.5).
 */
export function WishlistDrawer(): React.ReactNode {
  const { state, itemCount, removeItem, hydrated } = useWishlist();
  const { addItem } = useCart();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="relative flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium transition hover:bg-accent"
          aria-label={`Open wishlist (${itemCount} items)`}
        >
          <Heart className="h-4 w-4" />
          <span>Wishlist</span>
          {hydrated && itemCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-semibold text-black">
              {itemCount}
            </span>
          ) : null}
        </button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col gap-6 p-6 sm:max-w-md">
        <SheetHeader className="p-0">
          <SheetTitle className="text-2xl">Your wishlist</SheetTitle>
          <SheetDescription>
            {hydrated && itemCount > 0
              ? `${itemCount} item${itemCount === 1 ? "" : "s"}`
              : "Your wishlist is empty."}
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
                Your wishlist is empty
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Tap the heart on any product to save it here.
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
                    <Heart className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <h4 className="truncate text-sm font-medium">{item.name}</h4>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(item.price)}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-fit"
                    onClick={() => {
                      addItem({
                        productId: item.productId,
                        name: item.name,
                        price: item.price,
                        imageUrl: item.imageUrl ?? null,
                      });
                    }}
                  >
                    Add to cart
                  </Button>
                </div>
                <div className="flex flex-col items-end gap-3">
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
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
