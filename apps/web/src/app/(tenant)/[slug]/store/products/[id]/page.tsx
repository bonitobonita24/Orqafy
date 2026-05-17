import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";
import { formatCurrency } from "@/lib/quotation-build";

export const metadata: Metadata = { title: "Product" };

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string; id: string }>;
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
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <nav className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link href={`/${slug}/store/products`} className="hover:text-foreground">
          ← Back to shop
        </Link>
        {product.category !== null ? (
          <>
            <span>·</span>
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

      <div className="grid gap-8 md:grid-cols-2">
        <div className="space-y-3">
          <div className="aspect-square overflow-hidden rounded-lg border border-border bg-muted">
            {heroImage !== null ? (
              <img
                src={heroImage}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                No image
              </div>
            )}
          </div>
          {thumbnails.length > 0 ? (
            <div className="grid grid-cols-4 gap-2">
              {thumbnails.map((src, i) => (
                <div
                  key={i}
                  className="aspect-square overflow-hidden rounded-md border border-border bg-muted"
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

        <div className="space-y-4">
          <header className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">{product.name}</h1>
            {product.sku !== null ? (
              <p className="font-mono text-xs text-muted-foreground">
                SKU: {product.sku}
              </p>
            ) : null}
          </header>

          <p className="font-mono text-2xl font-semibold">
            {formatCurrency(price, "PHP")}
          </p>

          {desc !== null && desc.length > 0 ? (
            <div className="rounded-lg border border-border bg-card p-4">
              <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Description
              </h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                {desc}
              </p>
            </div>
          ) : null}

          <dl className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-card p-4 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Unit</dt>
              <dd className="mt-0.5">{product.unit}</dd>
            </div>
            {product.barcode !== null ? (
              <div>
                <dt className="text-xs text-muted-foreground">Barcode</dt>
                <dd className="mt-0.5 font-mono text-xs">{product.barcode}</dd>
              </div>
            ) : null}
            {product.weight !== null ? (
              <div>
                <dt className="text-xs text-muted-foreground">Weight</dt>
                <dd className="mt-0.5">{Number(product.weight)} kg</dd>
              </div>
            ) : null}
          </dl>

          <button
            type="button"
            disabled
            className="w-full cursor-not-allowed rounded-md border border-[#00d992]/40 bg-[#00d992]/5 px-4 py-3 text-sm font-medium text-[#00d992]/60"
            title="Cart and checkout coming in the next phase"
          >
            Place order (coming soon)
          </button>
          <p className="text-center text-xs text-muted-foreground">
            Checkout will be enabled in a future release.
          </p>
        </div>
      </div>
    </div>
  );
}
