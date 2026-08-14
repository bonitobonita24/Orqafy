import Link from "next/link";

import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/quotation-build";
import { cn } from "@/lib/utils";

/**
 * Shared storefront product card — reused by the store landing rails
 * (T2.2) and, later, the catalog grid + product detail "related" rail.
 * Shaped from the fields `mapPublicProduct` (server/trpc/routers/storefront.ts)
 * already returns, kept intentionally decoupled from that exact payload so any
 * caller can adapt its own query result into this shape.
 */
export interface StoreProductCardProduct {
  id: string;
  name: string;
  price: number;
  compareAtPrice: number | null;
  discountPercent: number | null;
  inStock: boolean;
  ecommerceSlug: string | null;
  ecommerceImageUrls: unknown;
  createdAt: string | Date;
  brand: { name: string } | null;
}

export interface StoreProductCardProps {
  tenantSlug: string;
  product: StoreProductCardProduct;
  className?: string;
}

const NEW_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

function firstImageUrl(images: unknown): string | null {
  if (!Array.isArray(images)) return null;
  const first = (images as unknown[])[0];
  return typeof first === "string" && first.length > 0 ? first : null;
}

function isNew(createdAt: string | Date): boolean {
  const created = createdAt instanceof Date ? createdAt : new Date(createdAt);
  return Date.now() - created.getTime() < NEW_WINDOW_MS;
}

export function StoreProductCard({
  tenantSlug,
  product,
  className,
}: StoreProductCardProps): React.ReactNode {
  const img = firstImageUrl(product.ecommerceImageUrls);
  const href = `/${tenantSlug}/store/products/${product.ecommerceSlug ?? product.id}`;
  const showNewBadge = isNew(product.createdAt);

  return (
    <Card
      data-fdl="store-product-card"
      className={cn("h-full gap-0 overflow-hidden border pt-0 shadow-none", className)}
    >
      <Link href={href} className="block">
        <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-muted">
          {img !== null ? (
            <img
              src={img}
              alt={product.name}
              className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
            />
          ) : (
            <span className="text-xs text-muted-foreground">No image</span>
          )}

          <div className="absolute top-3 left-3 flex flex-col gap-1">
            {showNewBadge ? (
              <Badge className="rounded-full bg-green-600 px-2 text-xs font-semibold text-white">
                New
              </Badge>
            ) : null}
            {product.discountPercent !== null && product.discountPercent > 0 ? (
              <Badge className="rounded-full bg-destructive px-2 text-xs font-semibold text-white">
                {product.discountPercent}% OFF
              </Badge>
            ) : null}
            {!product.inStock ? (
              <Badge variant="outline" className="rounded-full bg-background px-2 text-xs">
                Out of stock
              </Badge>
            ) : null}
          </div>
        </div>
      </Link>

      <CardContent className="flex flex-col gap-1.5 pt-4">
        {product.brand !== null ? (
          <p className="text-xs font-medium text-muted-foreground">{product.brand.name}</p>
        ) : null}
        <Link href={href} className="line-clamp-2 text-sm font-semibold hover:text-primary">
          {product.name}
        </Link>
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold">{formatCurrency(product.price, "PHP")}</span>
          {product.compareAtPrice !== null && product.compareAtPrice > product.price ? (
            <span className="text-xs text-muted-foreground line-through">
              {formatCurrency(product.compareAtPrice, "PHP")}
            </span>
          ) : null}
        </div>

        <div className="pt-2">
          <AddToCartButton
            productId={product.id}
            name={product.name}
            price={product.price}
            imageUrl={img}
          />
        </div>
      </CardContent>
    </Card>
  );
}
