import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Search as SearchIcon } from "@/components/ui/icons";

export interface StoreCatalogFilterCategory {
  id: string;
  name: string;
  slug: string;
}

export interface StoreCatalogFilterBrand {
  id: string;
  name: string;
}

export interface StoreCatalogFilterState {
  q?: string;
  category?: string;
  brand?: string;
  minPrice?: string;
  maxPrice?: string;
  onSale?: boolean;
  sort?: string;
}

interface StoreCatalogFiltersProps {
  tenantSlug: string;
  categories: StoreCatalogFilterCategory[];
  brands: StoreCatalogFilterBrand[];
  filters: StoreCatalogFilterState;
  /** Unique per rendered instance — this component is mounted twice (desktop
   * aside + mobile Sheet), so element `id`s must not collide in the DOM. */
  idPrefix: string;
}

/**
 * Catalog filter sidebar — adapted from starter/shopix shop/shop-filters.tsx.
 * Rating + color/size variant filters dropped (not modeled by this app's
 * Product schema, per template-alignment T2.3 scope). Everything here is a
 * real GET <form>/<Link> — no client JS needed, filters stay server-rendered
 * and shareable via the URL, matching the page's existing search+category
 * pattern (only the sort dropdown, rendered separately, needs a client
 * component). Reused as-is for both the desktop <aside> and the mobile
 * Sheet — the caller decides the wrapper.
 */
export function StoreCatalogFilters({
  tenantSlug,
  categories,
  brands,
  filters,
  idPrefix,
}: StoreCatalogFiltersProps): React.ReactNode {
  const basePath = `/${tenantSlug}/store/products`;
  const qId = `${idPrefix}-store-filter-q`;

  function buildQuery(
    patch: Partial<Record<keyof StoreCatalogFilterState, string | boolean | undefined>>,
  ): Record<string, string> {
    const merged: Record<string, string | boolean | undefined> = { ...filters, ...patch };
    const query: Record<string, string> = {};
    if (typeof merged.q === "string" && merged.q.length > 0) query.q = merged.q;
    if (typeof merged.category === "string" && merged.category.length > 0)
      query.category = merged.category;
    if (typeof merged.brand === "string" && merged.brand.length > 0) query.brand = merged.brand;
    if (typeof merged.minPrice === "string" && merged.minPrice.length > 0)
      query.minPrice = merged.minPrice;
    if (typeof merged.maxPrice === "string" && merged.maxPrice.length > 0)
      query.maxPrice = merged.maxPrice;
    if (merged.onSale === true) query.onSale = "1";
    if (typeof merged.sort === "string" && merged.sort.length > 0 && merged.sort !== "newest")
      query.sort = merged.sort;
    return query;
  }

  const hasAnyFilter =
    (filters.q !== undefined && filters.q.length > 0) ||
    (filters.category !== undefined && filters.category.length > 0) ||
    (filters.brand !== undefined && filters.brand.length > 0) ||
    (filters.minPrice !== undefined && filters.minPrice.length > 0) ||
    (filters.maxPrice !== undefined && filters.maxPrice.length > 0) ||
    filters.onSale === true;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Filter</h2>
        {hasAnyFilter ? (
          <Button variant="link" size="sm" className="h-auto p-0 text-destructive" asChild>
            <Link href={basePath}>Clear all</Link>
          </Button>
        ) : null}
      </div>

      <Separator />

      <form action={basePath} className="space-y-2">
        {filters.category !== undefined && filters.category.length > 0 ? (
          <input type="hidden" name="category" value={filters.category} />
        ) : null}
        {filters.brand !== undefined && filters.brand.length > 0 ? (
          <input type="hidden" name="brand" value={filters.brand} />
        ) : null}
        {filters.onSale === true ? <input type="hidden" name="onSale" value="1" /> : null}
        {filters.sort !== undefined && filters.sort.length > 0 && filters.sort !== "newest" ? (
          <input type="hidden" name="sort" value={filters.sort} />
        ) : null}
        <Label htmlFor={qId} className="text-sm font-medium">
          Search
        </Label>
        <div className="flex gap-2">
          <Input
            id={qId}
            type="search"
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Name or SKU…"
          />
          <Button type="submit" variant="secondary" size="sm" aria-label="Search">
            <SearchIcon className="size-4" />
          </Button>
        </div>
      </form>

      <Separator />

      <div className="space-y-3">
        <h3 className="text-sm font-medium">Category</h3>
        <nav aria-label="Categories" className="flex flex-col items-start gap-1.5">
          <Link href={{ pathname: basePath, query: buildQuery({ category: undefined }) }}>
            <Badge
              variant={filters.category === undefined || filters.category.length === 0 ? "default" : "outline"}
              className="cursor-pointer rounded-sm px-3 py-1"
            >
              All
            </Badge>
          </Link>
          {categories.map((c) => (
            <Link key={c.id} href={{ pathname: basePath, query: buildQuery({ category: c.slug }) }}>
              <Badge
                variant={filters.category === c.slug ? "default" : "outline"}
                className="cursor-pointer rounded-sm px-3 py-1"
              >
                {c.name}
              </Badge>
            </Link>
          ))}
        </nav>
      </div>

      {brands.length > 0 ? (
        <>
          <Separator />
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Brand</h3>
            <nav aria-label="Brands" className="flex flex-wrap gap-1.5">
              {brands.map((b) => (
                <Link key={b.id} href={{ pathname: basePath, query: buildQuery({ brand: filters.brand === b.id ? undefined : b.id }) }}>
                  <Badge
                    variant={filters.brand === b.id ? "default" : "outline"}
                    className="cursor-pointer rounded-sm px-3 py-1"
                  >
                    {b.name}
                  </Badge>
                </Link>
              ))}
            </nav>
          </div>
        </>
      ) : null}

      <Separator />

      <div className="space-y-3">
        <h3 className="text-sm font-medium">Price range (₱)</h3>
        <form action={basePath} className="space-y-2">
          {filters.category !== undefined && filters.category.length > 0 ? (
            <input type="hidden" name="category" value={filters.category} />
          ) : null}
          {filters.brand !== undefined && filters.brand.length > 0 ? (
            <input type="hidden" name="brand" value={filters.brand} />
          ) : null}
          {filters.q !== undefined && filters.q.length > 0 ? (
            <input type="hidden" name="q" value={filters.q} />
          ) : null}
          {filters.onSale === true ? <input type="hidden" name="onSale" value="1" /> : null}
          {filters.sort !== undefined && filters.sort.length > 0 && filters.sort !== "newest" ? (
            <input type="hidden" name="sort" value={filters.sort} />
          ) : null}
          <div className="flex items-center gap-2">
            <Input
              type="number"
              name="minPrice"
              min={0}
              step="0.01"
              defaultValue={filters.minPrice ?? ""}
              placeholder="Min"
              aria-label="Minimum price"
            />
            <span className="text-muted-foreground">–</span>
            <Input
              type="number"
              name="maxPrice"
              min={0}
              step="0.01"
              defaultValue={filters.maxPrice ?? ""}
              placeholder="Max"
              aria-label="Maximum price"
            />
          </div>
          <Button type="submit" variant="outline" size="sm" className="w-full">
            Apply price
          </Button>
        </form>
      </div>

      <Separator />

      <div className="space-y-3">
        <h3 className="text-sm font-medium">Deals</h3>
        <Link href={{ pathname: basePath, query: buildQuery({ onSale: filters.onSale !== true }) }}>
          <Badge
            variant={filters.onSale === true ? "default" : "outline"}
            className="cursor-pointer rounded-sm px-3 py-1"
          >
            On sale
          </Badge>
        </Link>
      </div>
    </div>
  );
}
