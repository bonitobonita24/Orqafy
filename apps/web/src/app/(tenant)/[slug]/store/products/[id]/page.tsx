import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TRPCError } from "@trpc/server";
import { prisma } from "@orqafy/db";
import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import { ProductGallery } from "@/components/store/product-gallery";
import { ProductSpecsTable, type ProductSpec } from "@/components/store/product-specs-table";
import { RelatedProducts } from "@/components/store/related-products";
import type { StoreProductCardProduct } from "@/components/store/product-card";
import { formatCurrency } from "@/lib/quotation-build";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ChevronLeft } from "@/components/ui/icons";
import { createServerCaller } from "@/server/trpc/server";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string; id: string }>;
}

// getProductBySlug's return shape (storefront.ts mapPublicProduct) — narrowed
// to the fields this page consumes so the two Prisma-free call sites below
// stay type-safe without re-declaring the full router output type.
interface StorefrontProduct {
  id: string;
  name: string;
  description: string | null;
  ecommerceDescription: string | null;
  ecommerceImageUrls: unknown;
  ecommerceSlug: string | null;
  ecommerceSpecs: unknown;
  sku: string | null;
  barcode: string | null;
  unit: string;
  weight: unknown;
  price: number;
  compareAtPrice: number | null;
  discountPercent: number | null;
  inStock: boolean;
  availableQuantity: number;
  brand: { id: string; name: string; logoUrl: string | null } | null;
  category: { id: string; name: string; slug: string; imageUrl: string | null } | null;
}

async function loadProduct(
  tenantSlug: string,
  id: string,
): Promise<StorefrontProduct | null> {
  const api = await createServerCaller();
  try {
    return (await api.storefront.getProductBySlug({
      tenantSlug,
      slug: id,
    })) as StorefrontProduct;
  } catch (err) {
    if (err instanceof TRPCError && err.code === "NOT_FOUND") return null;
    throw err;
  }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug, id } = await params;
  const product = await loadProduct(slug, id);

  const title = product?.name ?? "Product";
  const description =
    (product?.ecommerceDescription !== null &&
    product?.ecommerceDescription !== undefined &&
    product.ecommerceDescription.length > 0
      ? product.ecommerceDescription
      : product?.description) ?? "View product details.";
  // Canonical always points at the slug form when one exists, even if this
  // request arrived via the legacy cuid fallback (cce422b).
  const canonicalId = product?.ecommerceSlug ?? product?.id ?? id;
  const canonical = `/${slug}/store/products/${canonicalId}`;

  return {
    title,
    description,
    robots: { index: true, follow: true },
    alternates: { canonical },
    openGraph: { title, description, url: canonical },
  };
}

function imageUrls(images: unknown): string[] {
  if (!Array.isArray(images)) return [];
  const arr = images as unknown[];
  return arr.filter(
    (v): v is string => typeof v === "string" && v.length > 0,
  );
}

function parseSpecs(specs: unknown): ProductSpec[] {
  if (!Array.isArray(specs)) return [];
  const out: ProductSpec[] = [];
  for (const entry of specs) {
    if (
      entry !== null &&
      typeof entry === "object" &&
      "label" in entry &&
      "value" in entry &&
      typeof (entry as { label: unknown }).label === "string" &&
      typeof (entry as { value: unknown }).value === "string" &&
      (entry as { label: string }).label.length > 0
    ) {
      out.push({
        label: (entry as { label: string }).label,
        value: (entry as { value: string }).value,
      });
    }
  }
  return out;
}

// Related-products availability (same-category rail). browseProducts
// (storefront.ts) is a protectedProcedure gated on an authenticated session —
// calling it from this publicProcedure-only guest page would 403 every guest
// visitor (the exact class of bug fixed in 88190c4). Mirrors that router's
// own PUBLIC_PRODUCT_INCLUDE/loadAvailabilityMap read pattern locally instead
// via a direct scoped Prisma read, matching how this file already reads its
// primary product before this change and how store/products/page.tsx still
// reads its catalog — never touches storefront.ts.
async function loadRelatedProducts(
  tenantId: string,
  categoryId: string,
  excludeId: string,
): Promise<StoreProductCardProduct[]> {
  const items = await prisma.product.findMany({
    where: {
      tenantId,
      categoryId,
      id: { not: excludeId },
      isActive: true,
      ecommerceVisible: true,
    },
    include: { brand: { select: { name: true } } },
    orderBy: { name: "asc" },
    take: 4,
  });
  if (items.length === 0) return [];

  const stock = await prisma.warehouseStock.groupBy({
    by: ["productId"],
    where: { tenantId, productId: { in: items.map((p) => p.id) } },
    _sum: { quantity: true, reservedQuantity: true },
  });
  const availability = new Map(
    stock.map((s) => [
      s.productId,
      Number(s._sum.quantity ?? 0) - Number(s._sum.reservedQuantity ?? 0),
    ]),
  );

  return items.map((p) => {
    const baseCost = Number(p.baseCost);
    const tier1Price = p.tier1Price === null ? null : Number(p.tier1Price);
    const price = tier1Price !== null && tier1Price > 0 ? tier1Price : baseCost;
    const compareAtPrice = p.compareAtPrice === null ? null : Number(p.compareAtPrice);
    const discountPercent =
      compareAtPrice !== null && compareAtPrice > price && price >= 0
        ? Math.round((1 - price / compareAtPrice) * 100)
        : null;
    return {
      id: p.id,
      name: p.name,
      price,
      compareAtPrice,
      discountPercent,
      inStock: (availability.get(p.id) ?? 0) > 0,
      ecommerceSlug: p.ecommerceSlug,
      ecommerceImageUrls: p.ecommerceImageUrls,
      createdAt: p.createdAt,
      brand: p.brand,
    };
  });
}

export default async function PublicStorefrontProductDetailPage({
  params,
}: PageProps) {
  const { slug, id } = await params;

  const product = await loadProduct(slug, id);
  if (product === null) {
    notFound();
  }

  const images = imageUrls(product.ecommerceImageUrls);
  const specs = parseSpecs(product.ecommerceSpecs);
  const desc =
    product.ecommerceDescription !== null &&
    product.ecommerceDescription.length > 0
      ? product.ecommerceDescription
      : product.description;

  let related: StoreProductCardProduct[] = [];
  if (product.category !== null) {
    // tenantId isn't on the mapPublicProduct payload — resolve it once from
    // the category relation's own tenant scope via the tenant slug already
    // validated by getProductBySlug.
    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    if (tenant !== null) {
      related = await loadRelatedProducts(tenant.id, product.category.id, product.id);
    }
  }

  return (
    <section className="py-8 sm:py-16 lg:py-24">
      <div className="mx-auto max-w-6xl space-y-16 px-4 sm:px-6 lg:px-8">
        <div className="space-y-10">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link
              href={`/${slug}/store/products`}
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              <ChevronLeft className="size-4" />
              Back to shop
            </Link>
            {product.category !== null ? (
              <>
                <span aria-hidden="true">/</span>
                <Link
                  href={{
                    pathname: `/${slug}/store/products`,
                    query: { category: product.category.slug },
                  }}
                  className="hover:text-foreground"
                >
                  {product.category.name}
                </Link>
              </>
            ) : null}
          </nav>

          <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
            <div data-fdl="product-media">
              <ProductGallery images={images} alt={product.name} />
            </div>

            <div data-fdl="product-info" className="flex flex-col gap-6">
              <div className="space-y-2">
                {product.brand !== null ? (
                  <p className="text-sm font-medium text-muted-foreground">
                    {product.brand.name}
                  </p>
                ) : null}
                <h1 className="text-3xl font-semibold tracking-tight">
                  {product.name}
                </h1>
                {product.sku !== null ? (
                  <Badge variant="secondary" className="font-mono text-xs">
                    SKU: {product.sku}
                  </Badge>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-3xl font-semibold">
                  {formatCurrency(product.price, "PHP")}
                </span>
                {product.compareAtPrice !== null &&
                product.compareAtPrice > product.price ? (
                  <span className="text-lg text-muted-foreground line-through">
                    {formatCurrency(product.compareAtPrice, "PHP")}
                  </span>
                ) : null}
                {product.discountPercent !== null &&
                product.discountPercent > 0 ? (
                  <Badge className="bg-destructive text-white">
                    {product.discountPercent}% OFF
                  </Badge>
                ) : null}
                {product.inStock ? (
                  <Badge className="border-0 bg-green-600/10 text-green-600 dark:bg-green-400/10 dark:text-green-400">
                    In Stock
                  </Badge>
                ) : (
                  <Badge variant="outline">Out of stock</Badge>
                )}
              </div>

              {desc !== null && desc.length > 0 ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {desc}
                </p>
              ) : null}

              <Separator />

              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Unit</dt>
                  <dd className="mt-0.5 font-medium">{product.unit}</dd>
                </div>
                {product.barcode !== null ? (
                  <div>
                    <dt className="text-xs text-muted-foreground">Barcode</dt>
                    <dd className="mt-0.5 font-mono text-xs font-medium">
                      {product.barcode}
                    </dd>
                  </div>
                ) : null}
                {product.weight !== null ? (
                  <div>
                    <dt className="text-xs text-muted-foreground">Weight</dt>
                    <dd className="mt-0.5 font-medium">
                      {Number(product.weight)} kg
                    </dd>
                  </div>
                ) : null}
              </dl>

              <AddToCartButton
                productId={product.id}
                name={product.name}
                price={product.price}
                imageUrl={images[0] ?? null}
                disabled={!product.inStock}
              />
            </div>
          </div>
        </div>

        <ProductSpecsTable specs={specs} />

        <RelatedProducts tenantSlug={slug} products={related} />
      </div>
    </section>
  );
}
