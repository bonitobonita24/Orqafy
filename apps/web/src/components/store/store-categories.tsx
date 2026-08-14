import Link from "next/link";

export interface StoreCategoryItem {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
}

interface StoreCategoriesProps {
  categories: StoreCategoryItem[];
  tenantSlug: string;
}

/**
 * Adapted from starter/shopix home-categories.tsx + category-card.tsx. The
 * Shopix reference scrolls categories in an embla Carousel (not installed in
 * this app); a wrapping flex row with horizontal overflow gives the same
 * browsing affordance without the new dependency.
 */
export function StoreCategories({
  categories,
  tenantSlug,
}: StoreCategoriesProps): React.ReactNode {
  if (categories.length === 0) return null;

  return (
    <section data-fdl="store-categories" className="pt-10 sm:pt-16 lg:pt-20">
      <div className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold sm:text-2xl">Shop by Category</h3>
          <Link
            href={`/${tenantSlug}/store/products`}
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            View all
          </Link>
        </div>

        <div className="flex gap-6 overflow-x-auto pb-2">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/${tenantSlug}/store/products?category=${category.slug}`}
              className="group flex shrink-0 flex-col items-center gap-3"
            >
              <div className="flex size-24 items-center justify-center overflow-hidden rounded-full bg-muted transition-colors group-hover:bg-primary/10 sm:size-28">
                {category.imageUrl !== null ? (
                  <img
                    src={category.imageUrl}
                    alt={category.name}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {category.name.slice(0, 1)}
                  </span>
                )}
              </div>
              <span className="text-sm font-medium text-nowrap">{category.name}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
