import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  StoreCatalogFilters,
  type StoreCatalogFilterState,
} from "@/components/store/store-catalog-filters";
import { StoreFilterSheet } from "@/components/store/store-filter-sheet";
import { StoreProductCard } from "@/components/store/product-card";
import { StoreSortSelect, type StoreSortKey } from "@/components/store/store-sort-select";
import { createServerCaller } from "@/server/trpc/server";

export const dynamic = "force-dynamic";

const DEFAULT_TAKE = 24;

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    q?: string;
    page?: string;
    category?: string;
    brand?: string;
    minPrice?: string;
    maxPrice?: string;
    onSale?: string;
    sort?: string;
  }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: "Shop",
    description: "Browse products available for order.",
    robots: { index: true, follow: true },
    alternates: { canonical: `/${slug}/store/products` },
    openGraph: {
      title: "Shop",
      description: "Browse products available for order.",
      url: `/${slug}/store/products`,
    },
  };
}

const SORT_KEYS: StoreSortKey[] = ["newest", "price_asc", "price_desc"];

function isSortKey(value: string | undefined): value is StoreSortKey {
  return value !== undefined && (SORT_KEYS as string[]).includes(value);
}

export default async function PublicStorefrontProductsPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;

  const search = sp.q?.trim();
  const categorySlug = sp.category?.trim();
  const brandId = sp.brand?.trim();
  const minPrice = sp.minPrice !== undefined ? Number.parseFloat(sp.minPrice) : undefined;
  const maxPrice = sp.maxPrice !== undefined ? Number.parseFloat(sp.maxPrice) : undefined;
  const onSale = sp.onSale === "1";
  const sort: StoreSortKey = isSortKey(sp.sort) ? sp.sort : "newest";
  const pageNum = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const take = DEFAULT_TAKE;
  const skip = (pageNum - 1) * take;

  const api = await createServerCaller();

  const [categories, brands, browse] = await Promise.all([
    api.storefront.listCategories({ tenantSlug: slug }),
    api.storefront.listBrands({ tenantSlug: slug }),
    api.storefront.browsePublicProducts({
      tenantSlug: slug,
      ...(categorySlug !== undefined && categorySlug.length > 0 && { categorySlug }),
      ...(brandId !== undefined && brandId.length > 0 && { brandId }),
      ...(search !== undefined && search.length > 0 && { search }),
      ...(minPrice !== undefined && Number.isFinite(minPrice) && { minPrice }),
      ...(maxPrice !== undefined && Number.isFinite(maxPrice) && { maxPrice }),
      ...(onSale && { onSale }),
      sort,
      skip,
      take,
    }),
  ]);

  const { items, total } = browse;
  const totalPages = Math.max(1, Math.ceil(total / take));

  const filters: StoreCatalogFilterState = {
    ...(search !== undefined && search.length > 0 && { q: search }),
    ...(categorySlug !== undefined && categorySlug.length > 0 && { category: categorySlug }),
    ...(brandId !== undefined && brandId.length > 0 && { brand: brandId }),
    ...(sp.minPrice !== undefined && sp.minPrice.length > 0 && { minPrice: sp.minPrice }),
    ...(sp.maxPrice !== undefined && sp.maxPrice.length > 0 && { maxPrice: sp.maxPrice }),
    onSale,
    sort,
  };

  function pageHref(target: number): { pathname: string; query: Record<string, string> } {
    const query: Record<string, string> = {};
    if (filters.q !== undefined) query.q = filters.q;
    if (filters.category !== undefined) query.category = filters.category;
    if (filters.brand !== undefined) query.brand = filters.brand;
    if (filters.minPrice !== undefined) query.minPrice = filters.minPrice;
    if (filters.maxPrice !== undefined) query.maxPrice = filters.maxPrice;
    if (filters.onSale === true) query.onSale = "1";
    if (filters.sort !== undefined && filters.sort !== "newest") query.sort = filters.sort;
    query.page = String(target);
    return { pathname: `/${slug}/store/products`, query };
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Shop</h1>
          <p className="text-sm text-muted-foreground">
            {total} {total === 1 ? "product" : "products"} available
          </p>
        </div>
      </header>

      <div className="gap-8 lg:grid lg:grid-cols-4">
        <aside data-fdl="store-filter" className="hidden lg:col-span-1 lg:block">
          <StoreCatalogFilters
            tenantSlug={slug}
            categories={categories}
            brands={brands}
            filters={filters}
            idPrefix="desktop"
          />
        </aside>

        <div className="lg:col-span-3">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <StoreFilterSheet>
              <StoreCatalogFilters
                tenantSlug={slug}
                categories={categories}
                brands={brands}
                filters={filters}
                idPrefix="mobile"
              />
            </StoreFilterSheet>
            <div className="ml-auto">
              <StoreSortSelect value={sort} />
            </div>
          </div>

          {items.length === 0 ? (
            <Card className="shadow-none">
              <CardContent className="p-12 text-center">
                <p className="text-sm text-muted-foreground">
                  {search !== undefined && search.length > 0
                    ? `No products match "${search}".`
                    : "No products match these filters."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div
              data-fdl="store-grid"
              className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3"
            >
              {items.map((product) => (
                <StoreProductCard key={product.id} tenantSlug={slug} product={product} />
              ))}
            </div>
          )}

          {totalPages > 1 ? (
            <nav className="flex items-center justify-center gap-2 pt-8">
              {pageNum > 1 ? (
                <Button variant="outline" size="sm" asChild>
                  <Link href={pageHref(pageNum - 1)}>← Previous</Link>
                </Button>
              ) : null}
              <span className="text-xs text-muted-foreground">
                Page {pageNum} of {totalPages}
              </span>
              {pageNum < totalPages ? (
                <Button variant="outline" size="sm" asChild>
                  <Link href={pageHref(pageNum + 1)}>Next →</Link>
                </Button>
              ) : null}
            </nav>
          ) : null}
        </div>
      </div>
    </div>
  );
}
