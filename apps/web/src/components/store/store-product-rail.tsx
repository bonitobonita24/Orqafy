import {
  StoreProductCard,
  type StoreProductCardProduct,
} from "@/components/store/product-card";

interface StoreProductRailProps {
  title: string;
  products: StoreProductCardProduct[];
  tenantSlug: string;
  dataFdl: string;
}

/**
 * Shared grid rail for the featured-products + new-arrivals sections —
 * adapted from starter/shopix home-new-arrivals.tsx / home-popular-products.tsx
 * (the Shopix carousel variant needs embla-carousel, not installed here; a
 * responsive grid gives the same "browse a set of products" affordance).
 */
export function StoreProductRail({
  title,
  products,
  tenantSlug,
  dataFdl,
}: StoreProductRailProps): React.ReactNode {
  if (products.length === 0) return null;

  return (
    <section data-fdl={dataFdl} className="py-10 sm:py-16 lg:py-20">
      <div className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6 lg:px-8">
        <h3 className="text-xl font-bold sm:text-2xl">{title}</h3>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-6 xl:grid-cols-4">
          {products.map((product) => (
            <StoreProductCard key={product.id} tenantSlug={tenantSlug} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
}
