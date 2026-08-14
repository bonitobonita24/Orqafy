"use client";

import { toast } from "sonner";

import { Heart } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useWishlist } from "@/lib/wishlist-store";

export interface WishlistToggleButtonProps {
  productId: string;
  name: string;
  price: number;
  imageUrl?: string | null;
  className?: string;
  /** Larger, labeled variant for the product-detail page vs the compact
   * icon-only variant used on the product card. */
  variant?: "icon" | "labeled";
}

/**
 * Heart toggle shared by the product card grid + the product-detail page —
 * both read/write the same tenant-scoped `useWishlist()` context (T2.5).
 */
export function WishlistToggleButton({
  productId,
  name,
  price,
  imageUrl,
  className,
  variant = "icon",
}: WishlistToggleButtonProps): React.ReactNode {
  const { toggleItem, isWishlisted, hydrated } = useWishlist();
  const active = hydrated && isWishlisted(productId);

  function handleToggle(e: React.MouseEvent): void {
    e.preventDefault();
    e.stopPropagation();
    toggleItem({ productId, name, price, imageUrl: imageUrl ?? null });
    toast.success(active ? `Removed ${name} from wishlist` : `Added ${name} to wishlist`);
  }

  if (variant === "labeled") {
    return (
      <Button
        type="button"
        variant="outline"
        size="lg"
        onClick={handleToggle}
        disabled={!hydrated}
        className={cn("gap-2", className)}
        aria-pressed={active}
        aria-label={active ? `Remove ${name} from wishlist` : `Add ${name} to wishlist`}
      >
        <Heart
          className={cn("size-4", active ? "fill-destructive text-destructive" : "text-foreground")}
        />
        {active ? "Wishlisted" : "Add to wishlist"}
      </Button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={!hydrated}
      aria-pressed={active}
      aria-label={active ? `Remove ${name} from wishlist` : `Add ${name} to wishlist`}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-full bg-background/80 shadow-sm backdrop-blur-sm transition hover:bg-background disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      <Heart
        className={cn("size-4", active ? "fill-destructive text-destructive" : "text-muted-foreground")}
      />
    </button>
  );
}
