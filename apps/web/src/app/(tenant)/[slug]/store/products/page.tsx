import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@orqafy/db";
import { formatCurrency } from "@/lib/quotation-build";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Search as SearchIcon } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

const DEFAULT_TAKE = 24;
const MAX_TAKE = 96;

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; page?: string; category?: string }>;
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

function firstImageUrl(images: unknown): string | null {
  if (!Array.isArray(images)) return null;
  const arr = images as unknown[];
  const first = arr[0];
  return typeof first === "string" && first.length > 0 ? first : null;
}

function displayPrice(product: {
  tier1Price: unknown;
  baseCost: unknown;
}): number {
  const tier = Number(product.tier1Price);
  if (Number.isFinite(tier) && tier > 0) return tier;
  return Number(product.baseCost);
}

export default async function PublicStorefrontProductsPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const search = sp.q?.trim();
  const categorySlug = sp.category?.trim();
  const pageNum = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const take = DEFAULT_TAKE;
  const skip = (pageNum - 1) * take;

  const where: Record<string, unknown> = {
    isActive: true,
    ecommerceVisible: true,
  };
  if (search !== undefined && search.length > 0) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { sku: { contains: search, mode: "insensitive" } },
    ];
  }
  if (categorySlug !== undefined && categorySlug.length > 0) {
    where.category = { slug: categorySlug };
  }

  const [items, total, categories] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take: Math.min(take, MAX_TAKE),
    }),
    prisma.product.count({ where }),
    prisma.category.findMany({
      where: {
        isActive: true,
        products: {
          some: { isActive: true, ecommerceVisible: true },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, slug: true, name: true },
    }),
  ]);

  function buildCategoryHref(target: string | null): {
    pathname: string;
    query: Record<string, string>;
  } {
    const query: Record<string, string> = {};
    if (search !== undefined && search.length > 0) query.q = search;
    if (target !== null) query.category = target;
    return { pathname: `/${slug}/store/products`, query };
  }

  const totalPages = Math.max(1, Math.ceil(total / take));

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Shop</h1>
          <p className="text-sm text-muted-foreground">
            {total} {total === 1 ? "product" : "products"} available
          </p>
        </div>
      </header>

      <Card data-fdl="store-filter" className="shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <SearchIcon className="size-5" />
            Search &amp; Filter
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={`/${slug}/store/products`} className="flex gap-2">
            {categorySlug !== undefined && categorySlug.length > 0 ? (
              <input type="hidden" name="category" value={categorySlug} />
            ) : null}
            <Input
              type="search"
              name="q"
              defaultValue={search ?? ""}
              placeholder="Search by name or SKU…"
              className="max-w-sm"
            />
            <Button type="submit" variant="secondary" size="sm">
              Search
            </Button>
          </form>

          {categories.length > 0 ? (
            <nav
              aria-label="Categories"
              className="flex flex-wrap gap-2"
            >
              <Link href={buildCategoryHref(null)}>
                <Badge
                  variant={
                    categorySlug === undefined || categorySlug.length === 0
                      ? "default"
                      : "outline"
                  }
                  className="cursor-pointer rounded-sm px-3 py-1"
                >
                  All
                </Badge>
              </Link>
              {categories.map((c) => {
                const active = categorySlug === c.slug;
                return (
                  <Link key={c.id} href={buildCategoryHref(c.slug)}>
                    <Badge
                      variant={active ? "default" : "outline"}
                      className="cursor-pointer rounded-sm px-3 py-1"
                    >
                      {c.name}
                    </Badge>
                  </Link>
                );
              })}
            </nav>
          ) : null}
        </CardContent>
      </Card>

      {items.length === 0 ? (
        <Card className="shadow-none">
          <CardContent className="p-12 text-center">
            <p className="text-sm text-muted-foreground">
              {search !== undefined && search.length > 0
                ? `No products match "${search}".`
                : "No products available right now."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div
          data-fdl="store-grid"
          className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {items.map((product) => {
            const img = firstImageUrl(product.ecommerceImageUrls);
            const desc =
              product.ecommerceDescription !== null &&
              product.ecommerceDescription.length > 0
                ? product.ecommerceDescription
                : product.description;
            return (
              <Link
                key={product.id}
                href={`/${slug}/store/products/${product.id}`}
                className="block"
              >
                <Card className="h-full border-none shadow-none transition-colors hover:bg-muted/40">
                  <CardContent className="flex h-full flex-col justify-between gap-4">
                    <div className="mx-auto flex aspect-square w-full max-w-50 items-center justify-center overflow-hidden rounded-md bg-muted">
                      {img !== null ? (
                        <img
                          src={img}
                          alt={product.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          No image
                        </span>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-1 text-center">
                        <h2 className="line-clamp-2 text-base font-semibold">
                          {product.name}
                        </h2>
                        {product.sku !== null ? (
                          <p className="font-mono text-xs text-muted-foreground">
                            {product.sku}
                          </p>
                        ) : null}
                        {desc !== null && desc.length > 0 ? (
                          <p className="line-clamp-2 text-xs text-muted-foreground">
                            {desc}
                          </p>
                        ) : null}
                      </div>

                      <Separator />

                      <div className="flex items-center justify-center">
                        <span className="font-mono text-lg font-semibold">
                          {formatCurrency(displayPrice(product), "PHP")}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {totalPages > 1 ? (
        <nav className="flex items-center justify-center gap-2 pt-4">
          {pageNum > 1 ? (
            <Button variant="outline" size="sm" asChild>
              <Link
                href={{
                  pathname: `/${slug}/store/products`,
                  query: {
                    ...(search !== undefined && search.length > 0
                      ? { q: search }
                      : {}),
                    ...(categorySlug !== undefined && categorySlug.length > 0
                      ? { category: categorySlug }
                      : {}),
                    page: pageNum - 1,
                  },
                }}
              >
                ← Previous
              </Link>
            </Button>
          ) : null}
          <span className="text-xs text-muted-foreground">
            Page {pageNum} of {totalPages}
          </span>
          {pageNum < totalPages ? (
            <Button variant="outline" size="sm" asChild>
              <Link
                href={{
                  pathname: `/${slug}/store/products`,
                  query: {
                    ...(search !== undefined && search.length > 0
                      ? { q: search }
                      : {}),
                    ...(categorySlug !== undefined && categorySlug.length > 0
                      ? { category: categorySlug }
                      : {}),
                    page: pageNum + 1,
                  },
                }}
              >
                Next →
              </Link>
            </Button>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
