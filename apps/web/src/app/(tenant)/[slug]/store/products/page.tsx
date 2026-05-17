import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@orqafy/db";
import { formatCurrency } from "@/lib/quotation-build";

export const metadata: Metadata = { title: "Shop" };

export const dynamic = "force-dynamic";

const DEFAULT_TAKE = 24;
const MAX_TAKE = 96;

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
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

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take: Math.min(take, MAX_TAKE),
    }),
    prisma.product.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / take));

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Shop</h1>
          <p className="text-sm text-muted-foreground">
            {total} {total === 1 ? "product" : "products"} available
          </p>
        </div>
        <form
          action={`/${slug}/store/products`}
          className="flex gap-2"
        >
          <input
            type="search"
            name="q"
            defaultValue={search ?? ""}
            placeholder="Search by name or SKU…"
            className="w-64 rounded-md border border-border bg-card px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#00d992]"
          />
          <button
            type="submit"
            className="rounded-md border border-[#00d992] bg-[#00d992]/10 px-3 py-1.5 text-xs font-medium text-[#00d992] hover:bg-[#00d992]/20"
          >
            Search
          </button>
        </form>
      </header>

      {items.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground">
            {search !== undefined && search.length > 0
              ? `No products match "${search}".`
              : "No products available right now."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((product) => {
            const img = firstImageUrl(product.ecommerceImageUrls);
            const desc =
              product.ecommerceDescription !== null &&
              product.ecommerceDescription.length > 0
                ? product.ecommerceDescription
                : product.description;
            return (
              <div
                key={product.id}
                className="flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-[#00d992]/40"
              >
                <div className="aspect-square bg-muted">
                  {img !== null ? (
                    <img
                      src={img}
                      alt={product.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                      No image
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-1 p-3">
                  <h2 className="line-clamp-2 text-sm font-medium">
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
                  <p className="mt-auto pt-2 font-mono text-sm font-semibold">
                    {formatCurrency(displayPrice(product), "PHP")}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 ? (
        <nav className="flex items-center justify-center gap-2 pt-4">
          {pageNum > 1 ? (
            <Link
              href={{
                pathname: `/${slug}/store/products`,
                query: {
                  ...(search !== undefined && search.length > 0
                    ? { q: search }
                    : {}),
                  page: pageNum - 1,
                },
              }}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted"
            >
              ← Previous
            </Link>
          ) : null}
          <span className="text-xs text-muted-foreground">
            Page {pageNum} of {totalPages}
          </span>
          {pageNum < totalPages ? (
            <Link
              href={{
                pathname: `/${slug}/store/products`,
                query: {
                  ...(search !== undefined && search.length > 0
                    ? { q: search }
                    : {}),
                  page: pageNum + 1,
                },
              }}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted"
            >
              Next →
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
