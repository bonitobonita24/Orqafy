"use client";

import { useState } from "react";

import { Package } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

/**
 * Product-detail image gallery — adapted from the Shopix product-gallery /
 * product-carousel idiom (starter/shopix/src/views/pages/product/) into a
 * dependency-free static layout: a large 3:4 hero image + a thumbnail strip
 * that swaps the hero on click. No shadcn Carousel/embla — a real carousel
 * isn't needed for a handful of product photos.
 */
export interface ProductGalleryProps {
  images: string[];
  alt: string;
}

export function ProductGallery({
  images,
  alt,
}: ProductGalleryProps): React.ReactNode {
  const [selected, setSelected] = useState(0);
  const active = images[selected] ?? null;

  if (images.length === 0) {
    return (
      <div className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 rounded-xl bg-muted text-muted-foreground">
        <Package className="size-10" />
        <span className="text-xs">No image</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="aspect-[3/4] w-full overflow-hidden rounded-xl bg-muted">
        {active !== null ? (
          <img
            src={active}
            alt={alt}
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>
      {images.length > 1 ? (
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
          {images.map((src, index) => (
            <button
              key={src + String(index)}
              type="button"
              aria-label={`View image ${index + 1}`}
              aria-pressed={selected === index}
              onClick={() => setSelected(index)}
              className={cn(
                "aspect-[3/4] overflow-hidden rounded-md border bg-muted transition",
                selected === index
                  ? "border-primary ring-1 ring-primary"
                  : "border-border hover:border-primary/50",
              )}
            >
              <img
                src={src}
                alt={`${alt} thumbnail ${index + 1}`}
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
