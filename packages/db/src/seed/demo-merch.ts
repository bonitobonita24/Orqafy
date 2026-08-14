/**
 * demo-merch.ts
 *
 * Storefront merchandising for the DEMO tenant (template-alignment §3 — Shopix
 * parity): Brand directory, MerchContent (announcement/hero/promo), and
 * purchase history for the newly-added Shopix-style catalog products.
 *
 * ── SAFE TO RE-RUN (idempotent) ────────────────────────────────────────────
 * Brand: upsert on @@unique([tenantId, name]). MerchContent: upsert on
 * @@unique([tenantId, kind, title]) — endsAt/startsAt recomputed relative to
 * "now" on every run so a promo never silently expires, but the row identity
 * (kind+title) never changes, so re-running never duplicates.
 * ProductPurchaseHistory rows are guarded per-product (not a single global
 * count) so this can run alongside demo-ops-extras.ts without double-seeding
 * or skipping the newly-added SKUs.
 *
 * TypeScript strict: no `any`. Decimal fields passed as fixed(2) strings.
 */

import type { PrismaClient } from '@prisma/client';
import { money, dateAgo, at, round2 } from './demo-seed-utils';

const BRAND_ASSET_DIR = '/demo/shopix/brands';
const HERO_ASSET_DIR = '/demo/shopix/landing-page/hero-layout';
const DEAL_ASSET_DIR = '/demo/shopix/landing-page';

// ── Brands ────────────────────────────────────────────────────────────────

export const SHOPIX_BRANDS: ReadonlyArray<{ name: string; logoFile: string }> = [
  { name: 'Samsung', logoFile: 'samsung.webp' },
  { name: 'LG', logoFile: 'lg.webp' },
  { name: 'Zara', logoFile: 'zara.webp' },
  { name: 'H&M', logoFile: 'hm.webp' },
  { name: 'Chanel', logoFile: 'chanel.webp' },
  { name: 'Louis Vuitton', logoFile: 'louis-vuitton.webp' },
];

/** Upserts the 6 Shopix demo brands; returns a name → id lookup map. */
export async function seedBrands(
  prisma: PrismaClient,
  tenantId: string,
): Promise<Record<string, string>> {
  const brandIdByName: Record<string, string> = {};
  for (let i = 0; i < SHOPIX_BRANDS.length; i++) {
    const b = at(SHOPIX_BRANDS, i);
    const row = await prisma.brand.upsert({
      where: { tenantId_name: { tenantId, name: b.name } },
      update: { logoUrl: `${BRAND_ASSET_DIR}/${b.logoFile}`, isActive: true, sortOrder: i },
      create: {
        tenantId,
        name: b.name,
        logoUrl: `${BRAND_ASSET_DIR}/${b.logoFile}`,
        isActive: true,
        sortOrder: i,
      },
      select: { id: true },
    });
    brandIdByName[b.name] = row.id;
  }
  console.log(`  ✅ Brands: ${SHOPIX_BRANDS.length} seeded (Samsung/LG/Zara/H&M/Chanel/Louis Vuitton)`);
  return brandIdByName;
}

// ── MerchContent: announcement bar, hero banners, promo tiles ───────────────

export async function seedMerchContent(prisma: PrismaClient, tenantId: string): Promise<void> {
  const now = new Date();
  const daysFromNow = (n: number): Date => {
    const d = new Date(now);
    d.setDate(d.getDate() + n);
    return d;
  };

  type MerchDef = {
    kind: 'announcement' | 'hero' | 'promo';
    title: string;
    subtitle?: string;
    ctaLabel?: string;
    ctaHref?: string;
    imageUrl?: string;
    sortOrder: number;
    startsAt?: Date;
    endsAt?: Date;
  };

  const defs: readonly MerchDef[] = [
    {
      kind: 'announcement',
      title: 'Free Shipping Storewide',
      subtitle: 'Free shipping on orders over ₱2,000 — Metro Manila & major cities.',
      ctaLabel: 'Shop Now',
      ctaHref: '/store',
      sortOrder: 0,
    },
    {
      kind: 'hero',
      title: 'New Season Arrivals',
      subtitle: 'Discover the latest electronics and fashion picks, curated for you.',
      ctaLabel: 'Shop Collection',
      ctaHref: '/store/catalog',
      imageUrl: `${HERO_ASSET_DIR}/image-01.webp`,
      sortOrder: 0,
    },
    {
      kind: 'hero',
      title: 'Everyday Essentials, Better Prices',
      subtitle: 'Top-rated gadgets and gear at prices that make sense.',
      ctaLabel: 'Explore Deals',
      ctaHref: '/store/catalog?featured=true',
      imageUrl: `${HERO_ASSET_DIR}/image-02.webp`,
      sortOrder: 1,
    },
    {
      kind: 'promo',
      title: 'Flash Deal — Up to 30% Off Electronics',
      subtitle: 'Limited-time savings on featured tech essentials.',
      ctaLabel: 'Grab the Deal',
      ctaHref: '/store/catalog?category=electronics',
      imageUrl: `${DEAL_ASSET_DIR}/product-deal-01.webp`,
      sortOrder: 0,
      startsAt: daysFromNow(-3),
      endsAt: daysFromNow(14),
    },
    {
      kind: 'promo',
      title: 'Weekend Fashion Sale',
      subtitle: 'Fresh styles from Zara, H&M and more — while stocks last.',
      ctaLabel: 'Shop the Sale',
      ctaHref: '/store/catalog?category=fashion-apparel',
      imageUrl: `${DEAL_ASSET_DIR}/product-deal-02.webp`,
      sortOrder: 1,
      startsAt: daysFromNow(-1),
      endsAt: daysFromNow(10),
    },
  ];

  let count = 0;
  for (const d of defs) {
    await prisma.merchContent.upsert({
      where: { tenantId_kind_title: { tenantId, kind: d.kind, title: d.title } },
      update: {
        subtitle: d.subtitle ?? null,
        ctaLabel: d.ctaLabel ?? null,
        ctaHref: d.ctaHref ?? null,
        imageUrl: d.imageUrl ?? null,
        sortOrder: d.sortOrder,
        isActive: true,
        startsAt: d.startsAt ?? null,
        endsAt: d.endsAt ?? null,
      },
      create: {
        tenantId,
        kind: d.kind,
        title: d.title,
        subtitle: d.subtitle ?? null,
        ctaLabel: d.ctaLabel ?? null,
        ctaHref: d.ctaHref ?? null,
        imageUrl: d.imageUrl ?? null,
        sortOrder: d.sortOrder,
        isActive: true,
        startsAt: d.startsAt ?? null,
        endsAt: d.endsAt ?? null,
      },
    });
    count++;
  }
  console.log(`  ✅ MerchContent: ${count} rows (1 announcement, 2 hero, 2 promo w/ real future endsAt)`);
}

// ── ProductPurchaseHistory for the newly-added Shopix catalog SKUs ─────────
// Per-product guarded (not a single global count) so this composes safely
// with demo-ops-extras.ts's own (globally-guarded) purchase-history seed.

export async function seedNewProductPurchaseHistory(
  prisma: PrismaClient,
  tenantId: string,
  skus: readonly string[],
): Promise<void> {
  const vendors = await prisma.vendor.findMany({ where: { tenantId }, select: { id: true }, take: 10 });
  if (vendors.length === 0) {
    console.log('  ⏭  No vendors yet — skipping new-product purchase history.');
    return;
  }

  const products = await prisma.product.findMany({
    where: { tenantId, sku: { in: [...skus] } },
    select: { id: true, sku: true, baseCost: true },
  });

  let created = 0;
  for (let p = 0; p < products.length; p++) {
    const product = at(products, p);
    const existing = await prisma.productPurchaseHistory.count({ where: { tenantId, productId: product.id } });
    if (existing > 0) continue;

    const baseCost = Number(product.baseCost) > 0 ? Number(product.baseCost) : 500;
    const purchaseCount = 2 + (p % 2); // 2 or 3 rows per product
    for (let r = 0; r < purchaseCount; r++) {
      const drift = 1 + (r - 1) * 0.03;
      await prisma.productPurchaseHistory.create({
        data: {
          tenantId,
          productId: product.id,
          vendorId: at(vendors, p + r).id,
          unitPrice: money(round2(baseCost * drift)),
          quantity: money(15 + r * 10),
          currency: 'PHP',
          purchasedAt: dateAgo(75 - r * 25 - (p % 5) * 4),
        },
      });
      created++;
    }
  }
  console.log(`  ✅ Product purchase history: ${created} new row(s) across ${products.length} new SKU(s)`);
}
