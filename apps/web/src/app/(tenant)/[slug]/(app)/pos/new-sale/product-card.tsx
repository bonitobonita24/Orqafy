"use client";

// Product grid card — re-grafted from starter/restropos MenuItemCard interaction
// pattern (qty badge + hover stepper), adapted to our retail product shape.
// Reference (interaction ONLY, not imported): starter/restropos/src/views/apps/pos/left-panel/menu-item-card.tsx

import { useState } from "react";
import { Minus, Package, Plus } from "@/components/ui/icons";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/pos-cart";
import { cn } from "@/lib/utils";

export interface ProductCardData {
  id: string;
  name: string;
  unit: string;
  tier1Price: number | null;
  imageUrl: string | null;
}

interface Props {
  product: ProductCardData;
  quantityInCart: number;
  /** null = not stock-tracked (unlimited/service item). */
  availableQty: number | null;
  onAdd: () => void;
  onDecrement: () => void;
}

export function ProductCard({ product, quantityInCart, availableQty, onAdd, onDecrement }: Props) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const outOfStock = availableQty !== null && availableQty <= 0;

  return (
    <div
      onClick={() => !outOfStock && onAdd()}
      role="button"
      tabIndex={outOfStock ? -1 : 0}
      onKeyDown={(e) => {
        if (!outOfStock && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onAdd();
        }
      }}
      aria-disabled={outOfStock}
      className={cn(
        "group relative flex cursor-pointer flex-col overflow-hidden rounded-lg border border-border bg-card text-left transition-colors hover:border-primary/50",
        outOfStock && "cursor-not-allowed opacity-60 hover:border-border",
      )}
    >
      <div className="relative aspect-square w-full bg-muted">
        {product.imageUrl !== null && !imgError ? (
          <>
            {!imgLoaded && (
              <Skeleton className="absolute inset-0 h-full w-full rounded-none" />
            )}
            <img
              // A cached/instant image can finish loading BEFORE React attaches
              // onLoad, so onLoad never fires and the image stays opacity-0
              // (invisible) forever. The ref catches the already-complete case on
              // mount; onLoad covers the not-yet-loaded case. setState is a no-op
              // when already true, so the inline ref can't loop.
              ref={(node) => {
                if (node?.complete && node.naturalWidth > 0) setImgLoaded(true);
              }}
              src={product.imageUrl}
              alt={product.name}
              className={cn(
                "h-full w-full object-cover transition-opacity",
                imgLoaded ? "opacity-100" : "opacity-0",
              )}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
            />
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Package className="size-8 text-muted-foreground" />
          </div>
        )}

        {quantityInCart > 0 && (
          <Badge className="absolute right-1.5 top-1.5 px-1.5">{quantityInCart}</Badge>
        )}

        {outOfStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70">
            <span className="text-xs font-semibold text-muted-foreground">Out of stock</span>
          </div>
        )}

        {!outOfStock && (
          <div className="absolute inset-x-1.5 bottom-1.5 flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            {quantityInCart > 0 && (
              <button
                type="button"
                aria-label={`Remove one ${product.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onDecrement();
                }}
                className="flex size-6 items-center justify-center rounded-full bg-background text-foreground shadow-sm hover:bg-accent"
              >
                <Minus className="size-3.5" />
              </button>
            )}
            <button
              type="button"
              aria-label={`Add ${product.name}`}
              onClick={(e) => {
                e.stopPropagation();
                onAdd();
              }}
              className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm hover:opacity-90"
            >
              <Plus className="size-3.5" />
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-0.5 px-2 py-1.5">
        <span className="line-clamp-2 text-xs font-medium leading-tight">{product.name}</span>
        <span className="text-xs font-semibold text-primary">
          {product.tier1Price !== null ? formatCurrency(product.tier1Price) : "—"}
        </span>
      </div>
    </div>
  );
}
