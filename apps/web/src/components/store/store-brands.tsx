export interface StoreBrandItem {
  id: string;
  name: string;
  logoUrl: string | null;
}

interface StoreBrandsProps {
  brands: StoreBrandItem[];
}

/**
 * Adapted from starter/shopix home-brands.tsx. The Shopix reference scrolls
 * brand logos in an infinite Marquee (not installed in this app); a static
 * horizontally-scrollable row keeps the same "shop by brand" affordance
 * without the new dependency. Data-driven from Brand.logoUrl.
 */
export function StoreBrands({ brands }: StoreBrandsProps): React.ReactNode {
  const withLogo = brands.filter((b) => b.logoUrl !== null);
  if (withLogo.length === 0) return null;

  return (
    <section data-fdl="store-brands" className="py-8 sm:py-12">
      <div className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6 lg:px-8">
        <h3 className="text-center text-xl font-bold sm:text-2xl">Shop by Brand</h3>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {withLogo.map((brand) => (
            <div
              key={brand.id}
              className="flex w-32 shrink-0 items-center justify-center rounded-xl border py-5"
            >
              <img
                src={brand.logoUrl ?? undefined}
                alt={brand.name}
                className="h-7 w-auto max-w-none object-contain"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
