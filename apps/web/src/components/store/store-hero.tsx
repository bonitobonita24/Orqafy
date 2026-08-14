import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight } from "@/components/ui/icons";

export interface StoreHeroItem {
  id: string;
  title: string;
  subtitle: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  imageUrl: string | null;
}

interface StoreHeroProps {
  items: StoreHeroItem[];
  tenantSlug: string;
}

/**
 * Adapted from starter/shopix home-hero.tsx (the static 3-card grid variant —
 * home-hero-layout-01.tsx's product-variant carousel needs embla-carousel +
 * per-product variant images that MerchContent doesn't model, so it was left
 * out). Data-driven from MerchContent(kind="hero"); collapses gracefully when
 * a tenant has none configured.
 */
export function StoreHero({ items, tenantSlug }: StoreHeroProps): React.ReactNode {
  if (items.length === 0) return null;

  return (
    <section data-fdl="store-hero" className="pt-6 sm:pt-8 lg:pt-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div
          className={
            items.length === 1
              ? "grid grid-cols-1"
              : "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
          }
        >
          {items.map((item) => (
            <Card key={item.id} className="justify-between gap-0 bg-muted pb-0 shadow-none ring-0">
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h2 className="text-3xl font-bold sm:text-4xl">{item.title}</h2>
                  {item.subtitle !== null && item.subtitle.length > 0 ? (
                    <p className="text-base text-muted-foreground sm:text-lg">
                      {item.subtitle}
                    </p>
                  ) : null}
                </div>
                {item.ctaLabel !== null && item.ctaLabel.length > 0 ? (
                  <Button variant="outline" size="lg" asChild className="group">
                    <Link href={item.ctaHref ?? `/${tenantSlug}/store/products`}>
                      {item.ctaLabel}
                      <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1/4" />
                    </Link>
                  </Button>
                ) : null}
              </CardContent>
              {item.imageUrl !== null ? (
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className="ms-auto mt-auto max-h-56 w-auto object-contain p-4"
                />
              ) : null}
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
