import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";
import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import { formatCurrency } from "@/lib/quotation-build";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ChevronLeft, Package } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string; id: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug, id } = await params;
  const product = await prisma.product.findFirst({
    where: { id, isActive: true, ecommerceVisible: true },
    select: { name: true, description: true, ecommerceDescription: true },
  });

  const title = product?.name ?? "Product";
  const description =
    (product?.ecommerceDescription !== null &&
    product?.ecommerceDescription !== undefined &&
    product.ecommerceDescription.length > 0
      ? product.ecommerceDescription
      : product?.description) ?? "View product details.";
  const canonical = `/${slug}/store/products/${id}`;

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

function displayPrice(product: {
  tier1Price: unknown;
  baseCost: unknown;
}): number {
  const tier = Number(product.tier1Price);
  if (Number.isFinite(tier) && tier > 0) return tier;
  return Number(product.baseCost);
}

export default async function PublicStorefrontProductDetailPage({
  params,
}: PageProps) {
  const { slug, id } = await params;

  const product = await prisma.product.findFirst({
    where: {
      id,
      isActive: true,
      ecommerceVisible: true,
    },
    include: {
      category: { select: { id: true, slug: true, name: true } },
    },
  });

  if (product === null) {
    notFound();
  }

  const images = imageUrls(product.ecommerceImageUrls);
  const heroImage = images[0] ?? null;
  const thumbnails = images.slice(1);
  const desc =
    product.ecommerceDescription !== null &&
    product.ecommerceDescription.length > 0
      ? product.ecommerceDescription
      : product.description;
  const price = displayPrice(product);

  return (
    <section className="py-8 sm:py-16 lg:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <nav className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
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
          <div data-fdl="product-media" className="space-y-3">
            <div className="aspect-square overflow-hidden rounded-md bg-muted">
              {heroImage !== null ? (
                <img
                  src={heroImage}
                  alt={product.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Package className="size-10" />
                  <span className="text-xs">No image</span>
                </div>
              )}
            </div>
            {thumbnails.length > 0 ? (
              <div className="flex gap-3">
                {thumbnails.map((src, i) => (
                  <div
                    key={i}
                    className="size-16 shrink-0 overflow-hidden rounded-md bg-muted"
                  >
                    <img
                      src={src}
                      alt={`${product.name} image ${i + 2}`}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div data-fdl="product-info" className="flex flex-col justify-between gap-6">
            <div className="space-y-2">
              <h1 className="text-4xl font-semibold tracking-tight">
                {product.name}
              </h1>
              {product.sku !== null ? (
                <Badge variant="secondary" className="font-mono text-xs">
                  SKU: {product.sku}
                </Badge>
              ) : null}
              {desc !== null && desc.length > 0 ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {desc}
                </p>
              ) : null}
            </div>

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

            <Separator />

            <div className="flex w-full items-center justify-between gap-3">
              <span className="text-muted-foreground font-medium">Price</span>
              <span className="font-mono text-3xl font-semibold">
                {formatCurrency(price, "PHP")}
              </span>
            </div>

            <div className="space-y-2">
              <AddToCartButton
                productId={product.id}
                name={product.name}
                price={price}
                imageUrl={heroImage}
              />
              <p className="text-center text-xs text-muted-foreground">
                Checkout ships in the next batch.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
