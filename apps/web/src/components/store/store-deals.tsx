import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ArrowRight } from "@/components/ui/icons";
import { PromoCountdown } from "@/components/store/promo-countdown";
import {
  StoreProductCard,
  type StoreProductCardProduct,
} from "@/components/store/product-card";

export interface StorePromo {
  id: string;
  title: string;
  ctaLabel: string | null;
  ctaHref: string | null;
  endsAt: string | null;
}

interface StoreDealsProps {
  promo: StorePromo | null;
  products: StoreProductCardProduct[];
  tenantSlug: string;
}

/**
 * Adapted from starter/shopix home-deals.tsx + deals-promotional-card.tsx.
 * Promo card comes from MerchContent(kind="promo"); its countdown ticks to
 * the real `endsAt` (never a hardcoded time). Collapses gracefully when a
 * tenant has neither a promo nor featured products.
 */
export function StoreDeals({ promo, products, tenantSlug }: StoreDealsProps): React.ReactNode {
  if (promo === null && products.length === 0) return null;

  return (
    <section data-fdl="store-deals" className="py-10 sm:py-16 lg:py-20">
      <div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-6 lg:px-8">
        <h3 className="text-xl font-bold sm:text-2xl">Deals of the Day</h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {promo !== null ? (
            <Card className="h-full justify-between gap-0 bg-linear-to-br from-[#6AA4E1] to-[#9DC0E2] py-6 text-white shadow-none ring-0">
              <CardHeader className="px-6 text-2xl font-bold xl:text-3xl">
                {promo.title}
              </CardHeader>
              <CardContent className="flex flex-col gap-6 px-6">
                {promo.endsAt !== null ? (
                  <div>
                    <p className="mb-2 text-sm font-semibold">Offer ends:</p>
                    <PromoCountdown endsAt={promo.endsAt} />
                  </div>
                ) : null}
                <Button
                  className="group w-full border-destructive bg-destructive text-white transition-colors hover:bg-destructive/90"
                  asChild
                >
                  <Link href={promo.ctaHref ?? `/${tenantSlug}/store/products`}>
                    {promo.ctaLabel ?? "Shop Now"}
                    <ArrowRight className="transition-transform duration-300 group-hover:translate-x-1/4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {products.map((product) => (
            <StoreProductCard key={product.id} tenantSlug={tenantSlug} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
}
