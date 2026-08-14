import type { Metadata } from "next";

import { AnnouncementBanner } from "@/components/store/announcement-banner";
import { StoreBrands } from "@/components/store/store-brands";
import { StoreCategories } from "@/components/store/store-categories";
import { StoreDeals } from "@/components/store/store-deals";
import { StoreHero } from "@/components/store/store-hero";
import { StoreProductRail } from "@/components/store/store-product-rail";
import { createServerCaller } from "@/server/trpc/server";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: "Shop",
    description: "Browse our full catalog and latest offers.",
    robots: { index: true, follow: true },
    alternates: { canonical: `/${slug}/store` },
    openGraph: {
      title: "Shop",
      description: "Browse our full catalog and latest offers.",
      url: `/${slug}/store`,
    },
  };
}

export default async function PublicStorefrontLandingPage({
  params,
}: PageProps): Promise<React.ReactNode> {
  const { slug } = await params;
  const api = await createServerCaller();

  const [heroContent, promoContent, announcementContent, categories, brands, featured, newArrivals] =
    await Promise.all([
      api.storefront.listMerchContent({ tenantSlug: slug, kind: "hero" }),
      api.storefront.listMerchContent({ tenantSlug: slug, kind: "promo" }),
      api.storefront.listMerchContent({ tenantSlug: slug, kind: "announcement" }),
      api.storefront.listCategories({ tenantSlug: slug }),
      api.storefront.listBrands({ tenantSlug: slug }),
      api.storefront.listFeaturedProducts({ tenantSlug: slug, take: 3 }),
      api.storefront.listNewArrivals({ tenantSlug: slug, take: 8 }),
    ]);

  const promo = promoContent[0] ?? null;

  return (
    <>
      <AnnouncementBanner
        items={announcementContent.map((item) => ({ id: item.id, title: item.title }))}
      />

      <StoreHero
        tenantSlug={slug}
        items={heroContent.map((item) => ({
          id: item.id,
          title: item.title,
          subtitle: item.subtitle,
          ctaLabel: item.ctaLabel,
          ctaHref: item.ctaHref,
          imageUrl: item.imageUrl,
        }))}
      />

      <StoreCategories tenantSlug={slug} categories={categories} />

      <StoreDeals
        tenantSlug={slug}
        promo={
          promo === null
            ? null
            : {
                id: promo.id,
                title: promo.title,
                ctaLabel: promo.ctaLabel,
                ctaHref: promo.ctaHref,
                endsAt: promo.endsAt !== null ? promo.endsAt.toISOString() : null,
              }
        }
        products={featured}
      />

      <StoreProductRail
        dataFdl="store-new-arrivals"
        title="New Arrivals"
        tenantSlug={slug}
        products={newArrivals}
      />

      <StoreBrands brands={brands} />
    </>
  );
}
