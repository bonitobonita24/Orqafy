"use client";

import { useState } from "react";
import { toast } from "sonner";

import { useCart } from "@/lib/cart-store";

interface AddToCartButtonProps {
  productId: string;
  name: string;
  price: number;
  imageUrl?: string | null;
}

export function AddToCartButton({
  productId,
  name,
  price,
  imageUrl,
}: AddToCartButtonProps): React.ReactNode {
  const { addItem, hydrated } = useCart();
  const [quantity, setQuantity] = useState(1);

  function handleAdd(): void {
    addItem({ productId, name, price, imageUrl: imageUrl ?? null, quantity });
    toast.success(`Added ${quantity} × ${name} to cart`);
    setQuantity(1);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label
          htmlFor={`qty-${productId}`}
          className="text-xs text-muted-foreground"
        >
          Quantity
        </label>
        <input
          id={`qty-${productId}`}
          type="number"
          min={1}
          max={999}
          value={quantity}
          onChange={(e) => {
            const next = Number.parseInt(e.target.value, 10);
            setQuantity(Number.isFinite(next) && next > 0 ? next : 1);
          }}
          className="w-20 rounded-md border border-input bg-background px-2 py-1 text-sm"
        />
      </div>
      <button
        type="button"
        onClick={handleAdd}
        disabled={!hydrated}
        className="w-full rounded-md border border-[#00d992]/40 bg-[#00d992]/10 px-4 py-3 text-sm font-medium text-[#00d992] transition hover:bg-[#00d992]/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Add to cart
      </button>
    </div>
  );
}
