/**
 * demo-showcase.ts
 *
 * Enriches the DEMO tenant so a reviewer logging into the demo tenant sees
 * EVERY module populated with realistic Philippine-context dummy data — not
 * just the financials (invoices/expenses) that demo-financials.ts seeds.
 *
 * ── WHY public schema, not t_demo ──────────────────────────────────────────
 * Every model touched here is `@@schema("public")` and the app's tRPC routers
 * read the `public` schema isolated by `tenant_id` (the global unscoped Prisma
 * client). The vestigial `t_demo` schema is never read at runtime. So every row
 * is created in public with an explicit `tenantId = the demo tenant`. This
 * mirrors demo-financials.ts exactly.
 *
 * ── SAFE TO RE-RUN (idempotent) ────────────────────────────────────────────
 * None of these modules are seeded by index.ts or demo-financials.ts, so each
 * module is guarded by a per-tenant count of its primary model: if that model
 * already has ≥1 row for the demo tenant, the block is skipped. Deterministic,
 * human-readable numbers (DEMO-*) are used throughout. Parent rows (users,
 * warehouse, customers) are resolved by query — never hardcoded — so foreign
 * keys always point at real, tenant-scoped rows. Customers are reused if
 * demo-financials already created them; a small set is created if absent.
 *
 * TypeScript strict: no `any`. Decimal money/quantity fields are passed as
 * fixed(2)/plain numeric STRINGS (never JS floats) — Prisma accepts strings for
 * Decimal columns, avoiding float drift.
 *
 * Wired into src/seed/index.ts after the finance baseline; also importable.
 */

import type { PrismaClient } from '@prisma/client';
import { seedAccounting } from './demo-accounting';
import { seedBankingExtras } from './demo-banking-extras';
import { seedHrExtras } from './demo-hr-extras';
import { seedCrmExtras } from './demo-crm-extras';
import { seedOpsExtras } from './demo-ops-extras';
import { seedComplianceSettings } from './demo-compliance-settings';
import { seedDemoMedia } from './demo-media';
import { seedBrands, seedMerchContent, seedNewProductPurchaseHistory } from './demo-merch';

// ── helpers ──────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(9, 0, 0, 0);
  return d;
}

/** A date-only value (00:00) for @db.Date columns, n days ago. */
function dateAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Fixed-2 money string (no float drift). */
function money(n: number): string {
  return n.toFixed(2);
}

/** Non-null indexed pick that satisfies noUncheckedIndexedAccess. */
function at<T>(arr: readonly T[], i: number): T {
  const v = arr[i % arr.length];
  if (v === undefined) {
    throw new Error('demo-showcase: unexpected empty pool during pick');
  }
  return v;
}

const num = (i: number, width = 4): string => String(i).padStart(width, '0');

/** URL-safe slug from a product name (lowercase, hyphenated, no punctuation). */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** compareAtPrice ~10–35% above sellPrice, deterministic per index (no float drift). */
function compareAtFor(sellPrice: number, i: number): number {
  const factor = 1.1 + (i % 6) * 0.05; // 1.10 .. 1.35
  return Math.round(sellPrice * factor);
}

// ── main entry ─────────────────────────────────────────────────────────────

export async function seedDemoShowcase(
  prisma: PrismaClient,
  tenantId: string,
): Promise<void> {
  console.log('🎬 Seeding demo showcase data (all modules) into PUBLIC schema…');

  // ── Resolve shared FK targets (users, warehouse) ──────────────────────────
  const users = await prisma.user.findMany({
    where: { tenantId, isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, email: true, firstName: true, lastName: true },
  });
  if (users.length === 0) {
    throw new Error(
      'demo-showcase: no active users in demo tenant — run the main seed first.',
    );
  }
  const admin = at(users, 0);
  const adminId = admin.id;

  const warehouse = await prisma.warehouse.findFirst({
    where: { tenantId },
    orderBy: { isDefault: 'desc' },
    select: { id: true },
  });
  if (!warehouse) {
    throw new Error(
      'demo-showcase: no warehouse for demo tenant — run the main seed first.',
    );
  }
  const warehouseId = warehouse.id;

  // ── Ensure a handful of customers exist (reuse demo-financials rows) ───────
  const showcaseCustomers = [
    { companyName: 'Aboitiz Retail Ventures', firstName: 'Miguel', lastName: 'Aboitiz' },
    { companyName: 'Pinoy Fresh Grocers', firstName: 'Liza', lastName: 'Ramos' },
    { companyName: 'Visayas Builders Supply', firstName: 'Ramon', lastName: 'Villanueva' },
    { companyName: 'Metro Manila Clinics Group', firstName: 'Andrea', lastName: 'Lim' },
  ];
  for (const c of showcaseCustomers) {
    const existing = await prisma.customer.findFirst({
      where: { tenantId, companyName: c.companyName },
      select: { id: true },
    });
    if (!existing) {
      await prisma.customer.create({
        data: {
          tenantId,
          companyName: c.companyName,
          firstName: c.firstName,
          lastName: c.lastName,
          email: `${c.firstName.toLowerCase()}@${c.companyName.toLowerCase().replace(/[^a-z]+/g, '')}.ph`,
          phone: `+63 917 ${num(1000000 + showcaseCustomers.indexOf(c) * 111, 7)}`,
          city: 'Makati',
          province: 'Metro Manila',
          country: 'PH',
          tier: 'regular',
          isActive: true,
        },
      });
    }
  }
  const customers = await prisma.customer.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
    take: 20,
  });
  if (customers.length === 0) {
    throw new Error('demo-showcase: no customers available after ensure-step.');
  }
  const customerIds = customers.map((c) => c.id);

  // ── run each module block (each independently guarded + idempotent) ────────
  const brandIdByName = await seedBrands(prisma, tenantId);
  const productIds = await seedInventory(prisma, tenantId, adminId, warehouseId, brandIdByName);
  await seedCrm(prisma, tenantId, adminId, customerIds, productIds);
  await seedPurchasing(prisma, tenantId, adminId, productIds);
  await seedNewProductPurchaseHistory(
    prisma,
    tenantId,
    SHOWCASE_PRODUCTS.slice(8).map((p) => p.sku),
  );
  const projectId = await seedProjects(prisma, tenantId, adminId, users, customerIds);
  await seedInventoryDisbursement(prisma, tenantId, adminId, projectId, productIds);
  await seedTasks(prisma, tenantId, projectId, users);
  await seedHrPayroll(prisma, tenantId, adminId, users);
  await seedPos(prisma, tenantId, adminId, productIds, customerIds);
  await seedSupport(prisma, tenantId, users);
  await seedEcommerce(prisma, tenantId, customerIds, productIds);
  await seedRepairs(prisma, tenantId, adminId, users, customerIds, productIds);
  await seedBanking(prisma, tenantId, adminId);
  await seedInvoicesExpenses(prisma, tenantId, adminId, customerIds);

  // ── comprehensive gap-fill (every menu + sub-option) — each idempotent + self-resolving ──
  await seedAccounting(prisma, tenantId);
  await seedBankingExtras(prisma, tenantId);
  await seedHrExtras(prisma, tenantId);
  await seedCrmExtras(prisma, tenantId);
  await seedOpsExtras(prisma, tenantId);
  await seedComplianceSettings(prisma, tenantId, users);

  // ── media (images, signatures, file attachments) — run last so entities exist ──
  await seedMerchContent(prisma, tenantId);

  const tenantRow = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { slug: true } });
  await seedDemoMedia(prisma, tenantId, tenantRow?.slug ?? 'demo');

  console.log('  ✅ Demo showcase seeding complete.');
}

// ── Inventory: Category, Product, WarehouseStock, StockMovement ──────────────
// Returns the list of product ids (created or pre-existing) for downstream modules.

const PRODUCT_CARD_DIR = '/demo/shopix/product-card';
const PRODUCT_DETAILS_DIR = '/demo/shopix/product-details';

type ShowcaseProduct = {
  sku: string;
  name: string;
  catSlug: string;
  baseCost: number;
  sellPrice: number;
  unit: string;
  qty: number;
  reorder: number;
  brandName?: string;
  featured?: boolean;
  /** When true, a strikethrough compareAtPrice is derived; otherwise none (no "always on sale"). */
  onSale?: boolean;
  /** Age of the product in days (drives the "New" badge: <30d = New). Default 120. */
  ageDays?: number;
  cardImage: string;
  gallery: readonly string[];
  specs: ReadonlyArray<{ label: string; value: string }>;
};

// 24 demo products themed as a general consumer store, each matched to its
// vendored Shopix product photo (cardImage). SKUs 0001–0008 keep their
// sku/baseCost/sellPrice (POS/accounting/purchase-history reference these by
// SKU/id) — name/category/brand/image/specs are cosmetic. `onSale` gates the
// strikethrough compareAtPrice (no "everything on sale"); `ageDays` drives the
// "New" badge (<30d); two items ship qty:0 to demo an out-of-stock state.
const SHOWCASE_PRODUCTS: ShowcaseProduct[] = [
  {
    sku: 'DEMO-SKU-0001', name: 'Galaxy Pro 5G Smartphone 256GB', catSlug: 'electronics',
    baseCost: 32000, sellPrice: 41999, unit: 'pcs', qty: 25, reorder: 5,
    brandName: 'Samsung', featured: true, ageDays: 150,
    cardImage: `${PRODUCT_CARD_DIR}/image-01.webp`,
    gallery: [],
    specs: [
      { label: 'Display', value: '6.7" FHD+ AMOLED 120Hz' },
      { label: 'Processor', value: 'Octa-core 5G' },
      { label: 'Memory', value: '8GB RAM / 256GB' },
      { label: 'Camera', value: '50MP triple camera' },
      { label: 'Battery', value: '5000mAh, 45W fast charge' },
    ],
  },
  {
    sku: 'DEMO-SKU-0002', name: 'True Wireless Earbuds', catSlug: 'audio-wearables',
    baseCost: 350, sellPrice: 649, unit: 'pcs', qty: 150, reorder: 30,
    featured: true, onSale: true, ageDays: 10,
    cardImage: `${PRODUCT_CARD_DIR}/image-02.webp`,
    gallery: [`${PRODUCT_DETAILS_DIR}/boat-buds-01.webp`, `${PRODUCT_DETAILS_DIR}/boat-buds-02.webp`, `${PRODUCT_DETAILS_DIR}/boat-buds-03.webp`, `${PRODUCT_DETAILS_DIR}/boat-buds-04.webp`],
    specs: [
      { label: 'Driver', value: '10mm dynamic' },
      { label: 'Battery', value: '5h buds + 20h case' },
      { label: 'Bluetooth', value: '5.3, ENC calling' },
      { label: 'Charging', value: 'USB-C' },
    ],
  },
  {
    sku: 'DEMO-SKU-0003', name: 'Premium Over-Ear Headphones', catSlug: 'audio-wearables',
    baseCost: 6500, sellPrice: 8999, unit: 'pcs', qty: 40, reorder: 8,
    brandName: 'LG', featured: true, ageDays: 200,
    cardImage: `${PRODUCT_CARD_DIR}/image-04.webp`,
    gallery: [],
    specs: [
      { label: 'Type', value: 'Over-ear, closed-back' },
      { label: 'Noise Cancelling', value: 'Active ANC' },
      { label: 'Battery', value: 'Up to 40 hours' },
      { label: 'Connectivity', value: 'Bluetooth 5.2 + 3.5mm' },
    ],
  },
  {
    sku: 'DEMO-SKU-0004', name: 'Smart Watch Pro Series', catSlug: 'audio-wearables',
    baseCost: 2800, sellPrice: 4299, unit: 'pcs', qty: 30, reorder: 6,
    brandName: 'Samsung', featured: true, onSale: true, ageDays: 8,
    cardImage: `${PRODUCT_CARD_DIR}/image-06.webp`,
    gallery: [`${PRODUCT_DETAILS_DIR}/apple-watch-01.webp`, `${PRODUCT_DETAILS_DIR}/apple-watch-02.webp`, `${PRODUCT_DETAILS_DIR}/apple-watch-03.webp`, `${PRODUCT_DETAILS_DIR}/apple-watch-04.webp`],
    specs: [
      { label: 'Display', value: '1.9" AMOLED Always-On' },
      { label: 'Battery Life', value: 'Up to 40 hours' },
      { label: 'Water Resistance', value: '5 ATM' },
      { label: 'Compatibility', value: 'Android & iOS' },
    ],
  },
  {
    sku: 'DEMO-SKU-0005', name: 'Basic Bluetooth Earbuds', catSlug: 'audio-wearables',
    baseCost: 120, sellPrice: 249, unit: 'pcs', qty: 200, reorder: 40,
    ageDays: 90,
    cardImage: `${PRODUCT_CARD_DIR}/image-05.webp`,
    gallery: [`${PRODUCT_DETAILS_DIR}/boat-buds-01.webp`, `${PRODUCT_DETAILS_DIR}/boat-buds-02.webp`],
    specs: [
      { label: 'Battery', value: '4h buds + 12h case' },
      { label: 'Bluetooth', value: '5.1' },
      { label: 'Controls', value: 'Touch, mono/stereo' },
    ],
  },
  {
    sku: 'DEMO-SKU-0006', name: 'LED String Lights 5m', catSlug: 'home-living',
    baseCost: 180, sellPrice: 285, unit: 'pcs', qty: 500, reorder: 100,
    onSale: true, ageDays: 40,
    cardImage: `${PRODUCT_CARD_DIR}/image-22.webp`,
    gallery: [],
    specs: [
      { label: 'Length', value: '5 meters, 50 LEDs' },
      { label: 'Power', value: 'USB / battery' },
      { label: 'Modes', value: '8 lighting modes' },
    ],
  },
  {
    sku: 'DEMO-SKU-0007', name: 'Sport GPS Smartwatch', catSlug: 'audio-wearables',
    baseCost: 1500, sellPrice: 2399, unit: 'pcs', qty: 60, reorder: 12,
    ageDays: 60,
    cardImage: `${PRODUCT_CARD_DIR}/image-08.webp`,
    gallery: [`${PRODUCT_DETAILS_DIR}/apple-watch-02.webp`, `${PRODUCT_DETAILS_DIR}/apple-watch-03.webp`],
    specs: [
      { label: 'GPS', value: 'Built-in multi-band' },
      { label: 'Sport Modes', value: '100+' },
      { label: 'Battery', value: 'Up to 14 days' },
      { label: 'Water Resistance', value: '5 ATM' },
    ],
  },
  {
    sku: 'DEMO-SKU-0008', name: 'Ultra-Light Sunscreen SPF50', catSlug: 'home-living',
    baseCost: 85, sellPrice: 149, unit: 'pcs', qty: 300, reorder: 60,
    ageDays: 20,
    cardImage: `${PRODUCT_CARD_DIR}/image-14.webp`,
    gallery: [],
    specs: [
      { label: 'SPF', value: 'SPF 50 PA++++' },
      { label: 'Volume', value: '100ml' },
      { label: 'Skin Type', value: 'All, non-greasy' },
    ],
  },
  // ── Shopix-style catalog expansion (template-alignment §3) ────────────────
  {
    sku: 'DEMO-SKU-0009', name: 'Galaxy A-Series 5G Smartphone', catSlug: 'electronics',
    baseCost: 6500, sellPrice: 8999, unit: 'pcs', qty: 35, reorder: 8,
    brandName: 'Samsung', featured: true, onSale: true, ageDays: 5,
    cardImage: `${PRODUCT_CARD_DIR}/image-09.webp`,
    gallery: [],
    specs: [
      { label: 'Display', value: '6.5" FHD+ 90Hz' },
      { label: 'Memory', value: '6GB RAM / 128GB' },
      { label: 'Camera', value: '50MP dual camera' },
      { label: 'Battery', value: '5000mAh' },
    ],
  },
  {
    sku: 'DEMO-SKU-0010', name: 'Fitness Tracker Band', catSlug: 'audio-wearables',
    baseCost: 1800, sellPrice: 2599, unit: 'pcs', qty: 60, reorder: 12,
    ageDays: 45,
    cardImage: `${PRODUCT_CARD_DIR}/image-07.webp`,
    gallery: [],
    specs: [
      { label: 'Display', value: '1.47" color AMOLED' },
      { label: 'Tracking', value: 'Heart rate, SpO2, sleep' },
      { label: 'Battery', value: 'Up to 14 days' },
      { label: 'Water Resistance', value: '5 ATM' },
    ],
  },
  {
    sku: 'DEMO-SKU-0011', name: 'Scented Candle Gift Set', catSlug: 'home-living',
    baseCost: 350, sellPrice: 599, unit: 'set', qty: 90, reorder: 18,
    onSale: true, ageDays: 70,
    cardImage: `${PRODUCT_CARD_DIR}/image-20.webp`,
    gallery: [],
    specs: [
      { label: 'Includes', value: '5 soy-wax candles' },
      { label: 'Scents', value: 'Vanilla, lavender, amber, linen' },
      { label: 'Burn Time', value: '~25h each' },
    ],
  },
  {
    sku: 'DEMO-SKU-0012', name: 'Athletic Performance Tee', catSlug: 'fashion-apparel',
    baseCost: 280, sellPrice: 499, unit: 'pcs', qty: 120, reorder: 24,
    brandName: 'H&M', ageDays: 30,
    cardImage: `${PRODUCT_CARD_DIR}/image-10.webp`,
    gallery: [`${PRODUCT_DETAILS_DIR}/t-shirt-1.webp`, `${PRODUCT_DETAILS_DIR}/t-shirt-2.webp`, `${PRODUCT_DETAILS_DIR}/t-shirt-3.webp`, `${PRODUCT_DETAILS_DIR}/t-shirt-4.webp`],
    specs: [
      { label: 'Material', value: 'Moisture-wicking polyester' },
      { label: 'Fit', value: 'Athletic fit' },
      { label: 'Sizes', value: 'S, M, L, XL' },
      { label: 'Care', value: 'Machine washable' },
    ],
  },
  {
    sku: 'DEMO-SKU-0013', name: 'Classic Denim Jacket', catSlug: 'fashion-apparel',
    baseCost: 950, sellPrice: 1699, unit: 'pcs', qty: 45, reorder: 10,
    brandName: 'Zara', featured: true, onSale: true, ageDays: 12,
    cardImage: `${PRODUCT_CARD_DIR}/image-12.webp`,
    gallery: [],
    specs: [
      { label: 'Material', value: 'Cotton denim' },
      { label: 'Fit', value: 'Regular fit' },
      { label: 'Sizes', value: 'S, M, L, XL' },
    ],
  },
  {
    sku: 'DEMO-SKU-0014', name: 'Power Juicer & Blender Set', catSlug: 'home-kitchen',
    baseCost: 2200, sellPrice: 3999, unit: 'set', qty: 25, reorder: 5,
    brandName: 'LG', ageDays: 100,
    cardImage: `${PRODUCT_CARD_DIR}/image-17.webp`,
    gallery: [],
    specs: [
      { label: 'Motor', value: '1200W' },
      { label: 'Includes', value: 'Juicer jug + 4 grinder jars' },
      { label: 'Speed', value: '2 speeds + pulse' },
    ],
  },
  {
    sku: 'DEMO-SKU-0015', name: 'Digital Air Fryer 5L', catSlug: 'home-kitchen',
    baseCost: 1400, sellPrice: 2499, unit: 'pcs', qty: 55, reorder: 12,
    brandName: 'LG', featured: true, onSale: true, ageDays: 18,
    cardImage: `${PRODUCT_CARD_DIR}/image-15.webp`,
    gallery: [],
    specs: [
      { label: 'Capacity', value: '5L basket' },
      { label: 'Power', value: '1500W' },
      { label: 'Control', value: 'Digital touch, 8 presets' },
      { label: 'Temp Range', value: '80–200°C' },
    ],
  },
  {
    sku: 'DEMO-SKU-0016', name: '2-Slice Retro Toaster', catSlug: 'home-kitchen',
    baseCost: 1100, sellPrice: 1999, unit: 'pcs', qty: 0, reorder: 8,
    brandName: 'LG', ageDays: 80,
    cardImage: `${PRODUCT_CARD_DIR}/image-16.webp`,
    gallery: [],
    specs: [
      { label: 'Slots', value: '2 wide slots' },
      { label: 'Settings', value: '6 browning levels' },
      { label: 'Features', value: 'Defrost, reheat, cancel' },
    ],
  },
  {
    sku: 'DEMO-SKU-0017', name: 'Pullover Hoodie', catSlug: 'fashion-apparel',
    baseCost: 650, sellPrice: 999, unit: 'pcs', qty: 75, reorder: 15,
    brandName: 'H&M', onSale: true, ageDays: 55,
    cardImage: `${PRODUCT_CARD_DIR}/image-11.webp`,
    gallery: [],
    specs: [
      { label: 'Material', value: 'Cotton-blend fleece' },
      { label: 'Fit', value: 'Relaxed fit' },
      { label: 'Sizes', value: 'S, M, L, XL' },
      { label: 'Features', value: 'Kangaroo pocket, drawstring hood' },
    ],
  },
  {
    sku: 'DEMO-SKU-0018', name: 'Slim-Fit Jeans', catSlug: 'fashion-apparel',
    baseCost: 480, sellPrice: 799, unit: 'pcs', qty: 100, reorder: 20,
    brandName: 'Zara', ageDays: 65,
    cardImage: `${PRODUCT_CARD_DIR}/image-13.webp`,
    gallery: [],
    specs: [
      { label: 'Material', value: 'Stretch denim' },
      { label: 'Fit', value: 'Slim fit' },
      { label: 'Sizes', value: '28 – 38 waist' },
    ],
  },
  {
    sku: 'DEMO-SKU-0019', name: 'Wireless Game Controller', catSlug: 'electronics',
    baseCost: 1800, sellPrice: 2799, unit: 'pcs', qty: 40, reorder: 8,
    onSale: true, ageDays: 25,
    cardImage: `${PRODUCT_CARD_DIR}/image-03.webp`,
    gallery: [],
    specs: [
      { label: 'Connectivity', value: '2.4GHz + Bluetooth' },
      { label: 'Compatibility', value: 'PC, Android, iOS' },
      { label: 'Battery', value: 'Rechargeable, ~20h' },
      { label: 'Features', value: 'Dual vibration, turbo' },
    ],
  },
  {
    sku: 'DEMO-SKU-0020', name: 'Abstract Wall Art (Set of 3)', catSlug: 'home-living',
    baseCost: 1500, sellPrice: 2299, unit: 'set', qty: 0, reorder: 6,
    ageDays: 110,
    cardImage: `${PRODUCT_CARD_DIR}/image-19.webp`,
    gallery: [],
    specs: [
      { label: 'Set', value: '3 framed prints' },
      { label: 'Size', value: 'A3 each' },
      { label: 'Finish', value: 'Matte, ready to hang' },
    ],
  },
  {
    sku: 'DEMO-SKU-0021', name: 'Ceramic Vase Duo', catSlug: 'home-living',
    baseCost: 750, sellPrice: 1299, unit: 'set', qty: 65, reorder: 14,
    ageDays: 95,
    cardImage: `${PRODUCT_CARD_DIR}/image-21.webp`,
    gallery: [],
    specs: [
      { label: 'Set', value: '2 ceramic vases' },
      { label: 'Finish', value: 'Matte glazed' },
      { label: 'Style', value: 'Modern minimalist' },
    ],
  },
  {
    sku: 'DEMO-SKU-0022', name: 'Framed Landscape Print', catSlug: 'home-living',
    baseCost: 220, sellPrice: 399, unit: 'pcs', qty: 140, reorder: 28,
    onSale: true, ageDays: 50,
    cardImage: `${PRODUCT_CARD_DIR}/image-18.webp`,
    gallery: [],
    specs: [
      { label: 'Size', value: 'A3 (30 x 42cm)' },
      { label: 'Frame', value: 'Wood-finish, glass front' },
      { label: 'Mount', value: 'Tabletop stand + wall hook' },
    ],
  },
  {
    sku: 'DEMO-SKU-0023', name: 'City Building Blocks (500 pcs)', catSlug: 'toys-games',
    baseCost: 380, sellPrice: 649, unit: 'set', qty: 70, reorder: 14,
    ageDays: 75,
    cardImage: `${PRODUCT_CARD_DIR}/image-24.webp`,
    gallery: [],
    specs: [
      { label: 'Pieces', value: '500 blocks' },
      { label: 'Age', value: '6+' },
      { label: 'Theme', value: 'City builder set' },
    ],
  },
  {
    sku: 'DEMO-SKU-0024', name: 'Motorized Race Track Set', catSlug: 'toys-games',
    baseCost: 620, sellPrice: 999, unit: 'set', qty: 55, reorder: 11,
    featured: true, onSale: true, ageDays: 35,
    cardImage: `${PRODUCT_CARD_DIR}/image-23.webp`,
    gallery: [],
    specs: [
      { label: 'Track', value: 'Multi-level loop track' },
      { label: 'Includes', value: '2 motorized cars' },
      { label: 'Age', value: '4+' },
    ],
  },
];

// Consumer/lifestyle taxonomy that matches the vendored Shopix product photos.
// The 4 legacy B2B slugs (hardware-tools/office-supplies-cat/networking/consumables)
// are no longer referenced by any showcase product; they go empty on reseed and are
// hidden from the storefront (listCategories filters to categories that HAVE a visible
// product), so no destructive cleanup is needed.
const SHOWCASE_CATEGORIES: Array<{ name: string; slug: string; imageUrl: string }> = [
  { name: 'Electronics', slug: 'electronics', imageUrl: '/demo/shopix/category-listing/electronic-01.webp' },
  { name: 'Audio & Wearables', slug: 'audio-wearables', imageUrl: '/demo/shopix/category-listing/category-hero-01.webp' },
  { name: 'Home & Kitchen', slug: 'home-kitchen', imageUrl: '/demo/shopix/category-listing/category-hero-02.webp' },
  { name: 'Home & Living', slug: 'home-living', imageUrl: '/demo/shopix/category-listing/category-hero-03.webp' },
  { name: 'Fashion & Apparel', slug: 'fashion-apparel', imageUrl: '/demo/shopix/category-listing/clothing-01.webp' },
  { name: 'Toys & Games', slug: 'toys-games', imageUrl: '/demo/shopix/category-listing/bag.webp' },
];

async function seedInventory(
  prisma: PrismaClient,
  tenantId: string,
  adminId: string,
  warehouseId: string,
  brandIdByName: Record<string, string>,
): Promise<string[]> {
  // Categories (idempotent via app-level find-then-write — NOT prisma upsert
  // on the compound tenantId_slug key: this dev DB has pre-existing schema
  // drift where the categories unique index is still the legacy single-column
  // `categories_slug_key`, not the compound `(tenant_id, slug)` key that
  // schema.prisma declares — documented in migration
  // 20260814133917_add_brand_merchcontent_ecommerce_fields as pre-existing
  // and explicitly out of scope for that change. find-then-write sidesteps
  // it without touching schema/migrations. imageUrl always re-asserted so
  // pre-migration categories get backfilled with a tile.)
  const catIdBySlug: Record<string, string> = {};
  for (let i = 0; i < SHOWCASE_CATEGORIES.length; i++) {
    const c = at(SHOWCASE_CATEGORIES, i);
    const existingCat = await prisma.category.findFirst({
      where: { tenantId, slug: c.slug },
      select: { id: true },
    });
    const cat = existingCat
      ? await prisma.category.update({
          where: { id: existingCat.id },
          data: { imageUrl: c.imageUrl },
          select: { id: true },
        })
      : await prisma.category.create({
          data: { tenantId, name: c.name, slug: c.slug, imageUrl: c.imageUrl, sortOrder: i, isActive: true },
          select: { id: true },
        });
    catIdBySlug[c.slug] = cat.id;
  }

  // Clear stale ecommerceSlugs first. A retheme reshuffles product identities
  // (e.g. SKU-0004's new name was SKU-0009's old name), so a per-row upsert can
  // otherwise hit the (tenant_id, ecommerce_slug) unique index against a
  // not-yet-updated row's OLD slug mid-loop. NULLing them first (NULLs don't
  // collide in Postgres) lets the loop re-assign fresh unique slugs cleanly.
  await prisma.product.updateMany({
    where: { tenantId, sku: { in: SHOWCASE_PRODUCTS.map((sp) => sp.sku) } },
    data: { ecommerceSlug: null },
  });

  // Dedupe ecommerceSlug across the catalog (append -2, -3, … on collision).
  const slugSeen: Record<string, number> = {};
  const slugFor = (name: string): string => {
    const base = slugify(name);
    const n = slugSeen[base] ?? 0;
    slugSeen[base] = n + 1;
    return n === 0 ? base : `${base}-${n + 1}`;
  };

  const productIds: string[] = [];
  for (let i = 0; i < SHOWCASE_PRODUCTS.length; i++) {
    const p = at(SHOWCASE_PRODUCTS, i);
    const isNewlyCreated = (await prisma.product.count({ where: { sku: p.sku } })) === 0;

    const product = await prisma.product.upsert({
      where: { sku: p.sku },
      update: {
        // name/unit/createdAt re-asserted so a retheme (rename, recategorize,
        // backdate for the "New" badge) applies on reseed without a full wipe.
        name: p.name,
        description: `${p.name} — demo showcase stock item.`,
        unit: p.unit,
        createdAt: dateAgo(p.ageDays ?? 120),
        categoryId: catIdBySlug[p.catSlug] ?? null,
        brandId: p.brandName !== undefined && p.brandName.length > 0
          ? (brandIdByName[p.brandName] ?? null)
          : null,
        compareAtPrice: p.onSale === true ? money(compareAtFor(p.sellPrice, i)) : null,
        isFeatured: p.featured ?? false,
        ecommerceSlug: slugFor(p.name),
        ecommerceSpecs: p.specs.map((s) => ({ label: s.label, value: s.value })),
        ecommerceImageUrls: [p.cardImage, ...p.gallery],
        ecommerceVisible: true,
        ecommerceDescription: `Buy ${p.name} online.`,
      },
      create: {
        tenantId,
        sku: p.sku,
        name: p.name,
        description: `${p.name} — demo showcase stock item.`,
        categoryId: catIdBySlug[p.catSlug] ?? null,
        brandId: p.brandName !== undefined && p.brandName.length > 0
          ? (brandIdByName[p.brandName] ?? null)
          : null,
        unit: p.unit,
        baseCost: money(p.baseCost),
        tier1Price: money(p.sellPrice),
        tier2Price: money(Math.round(p.sellPrice * 0.95)),
        tier3Price: money(Math.round(p.sellPrice * 0.9)),
        compareAtPrice: p.onSale === true ? money(compareAtFor(p.sellPrice, i)) : null,
        createdAt: dateAgo(p.ageDays ?? 120),
        isFeatured: p.featured ?? false,
        ecommerceSlug: slugFor(p.name),
        ecommerceSpecs: p.specs.map((s) => ({ label: s.label, value: s.value })),
        ecommerceImageUrls: [p.cardImage, ...p.gallery],
        reorderLevel: p.reorder,
        reorderQuantity: p.reorder * 2,
        isActive: true,
        ecommerceVisible: true,
        ecommerceDescription: `Buy ${p.name} online.`,
      },
      select: { id: true },
    });
    productIds.push(product.id);

    // Opening stock in the main warehouse (idempotent — only for a genuinely
    // new product; an already-existing SKU keeps its live stock/movements).
    if (isNewlyCreated) {
      await prisma.warehouseStock.create({
        data: { tenantId, warehouseId, productId: product.id, quantity: money(p.qty) },
      });
      await prisma.stockMovement.create({
        data: {
          tenantId,
          productId: product.id,
          type: 'in',
          quantity: money(p.qty),
          toWarehouseId: warehouseId,
          referenceType: 'opening_stock',
          notes: 'Opening balance (demo showcase seed)',
          createdById: adminId,
        },
      });
    } else {
      // Re-assert opening stock on reseed so qty changes (e.g. the out-of-stock
      // demo items) take effect without a full wipe. No new movement recorded.
      await prisma.warehouseStock.updateMany({
        where: { tenantId, warehouseId, productId: product.id },
        data: { quantity: money(p.qty) },
      });
    }
  }
  console.log(`  ✅ Inventory: ${SHOWCASE_CATEGORIES.length} categories, ${productIds.length} products (Shopix-style catalog, real photos/specs/brands)`);
  return productIds;
}

// ── CRM: Quotation (+section+line items), Proposal, ContactLog ───────────────

async function seedCrm(
  prisma: PrismaClient,
  tenantId: string,
  adminId: string,
  customerIds: string[],
  productIds: string[],
): Promise<void> {
  const existing = await prisma.quotation.count({ where: { tenantId } });
  if (existing > 0) {
    console.log(`  ⏭  CRM already seeded (${existing} quotations). Skipping.`);
    return;
  }

  // 4 quotations, each with one section + a couple of line items
  const quoteTitles = [
    'IT Equipment Refresh — Q3',
    'Office Fit-out Supplies',
    'Network Upgrade Proposal',
    'Bulk Consumables Order',
  ];
  for (let i = 0; i < quoteTitles.length; i++) {
    const lineCount = 2 + (i % 2);
    let subtotal = 0;
    const lines: Array<{ description: string; unit: string; quantity: number; baseCost: number; productId: string }> = [];
    for (let j = 0; j < lineCount; j++) {
      const pIdx = (i + j) % productIds.length;
      const qty = 2 + j;
      const cost = 1500 + i * 500 + j * 250;
      subtotal += qty * cost;
      lines.push({
        description: `Line item ${j + 1} for ${at(quoteTitles, i)}`,
        unit: 'pcs',
        quantity: qty,
        baseCost: cost,
        productId: at(productIds, pIdx),
      });
    }
    const tax = Math.round(subtotal * 0.12);
    await prisma.quotation.create({
      data: {
        tenantId,
        quotationNumber: `DEMO-QUO-${num(i + 1)}`,
        customerId: at(customerIds, i),
        createdById: adminId,
        title: at(quoteTitles, i),
        status: i === 0 ? 'accepted' : i === 1 ? 'sent' : 'draft',
        validUntil: daysAgo(-30),
        subtotal: money(subtotal),
        taxAmount: money(tax),
        totalAmount: money(subtotal + tax),
        currency: 'PHP',
        notes: 'Prepared for demo review.',
        sentAt: i <= 1 ? daysAgo(10 + i) : null,
        acceptedAt: i === 0 ? daysAgo(5) : null,
        sections: {
          create: [
            {
              tenantId,
              name: 'Main',
              description: 'Primary section',
              sortOrder: 0,
              lineItems: {
                create: lines.map((l, k) => ({
                  tenantId,
                  productId: l.productId,
                  description: l.description,
                  unit: l.unit,
                  quantity: money(l.quantity),
                  baseCost: money(l.baseCost),
                  sortOrder: k,
                })),
              },
            },
          ],
        },
      },
    });
  }

  // 3 proposals
  const proposalTitles = [
    'Managed IT Services — Annual',
    'Digital Transformation Roadmap',
    'Maintenance & Support Retainer',
  ];
  for (let i = 0; i < proposalTitles.length; i++) {
    await prisma.proposal.create({
      data: {
        tenantId,
        proposalNumber: `DEMO-PRO-${num(i + 1)}`,
        customerId: at(customerIds, i),
        createdById: adminId,
        title: at(proposalTitles, i),
        description: 'A demo proposal describing scope, deliverables and pricing.',
        status: i === 0 ? 'accepted' : i === 1 ? 'sent' : 'draft',
        validUntil: daysAgo(-45),
        totalAmount: money(120000 + i * 45000),
        currency: 'PHP',
        sentAt: i <= 1 ? daysAgo(14 + i) : null,
        acceptedAt: i === 0 ? daysAgo(7) : null,
      },
    });
  }

  // Contact logs across customers
  const contactTypes = ['call', 'email', 'meeting', 'note'];
  const contactSubjects = [
    'Follow-up on quotation',
    'Discussed delivery schedule',
    'Onsite requirements meeting',
    'Sent updated pricing',
    'Courtesy check-in call',
    'Contract renewal discussion',
  ];
  for (let i = 0; i < 6; i++) {
    await prisma.contactLog.create({
      data: {
        tenantId,
        customerId: at(customerIds, i),
        createdById: adminId,
        type: at(contactTypes, i),
        subject: at(contactSubjects, i),
        body: 'Logged during demo showcase seeding.',
        occurredAt: daysAgo(3 + i * 2),
      },
    });
  }
  console.log('  ✅ CRM: 4 quotations (+sections/line items), 3 proposals, 6 contact logs');
}

// ── Purchasing: Vendor → PurchaseOrder → items → GoodsReceipt → PurchaseInvoice

async function seedPurchasing(
  prisma: PrismaClient,
  tenantId: string,
  adminId: string,
  productIds: string[],
): Promise<void> {
  // Vendors (guard by count)
  if ((await prisma.vendor.count({ where: { tenantId } })) === 0) {
    const vendors = [
      { companyName: 'TechDistro Philippines Inc.', contactName: 'Paolo Cruz', paymentTerms: 'NET 30' },
      { companyName: 'Hardware Warehouse Cebu', contactName: 'Grace Uy', paymentTerms: 'NET 15' },
      { companyName: 'OfficeMart Supplies Corp.', contactName: 'Danilo Reyes', paymentTerms: 'COD' },
    ];
    for (const v of vendors) {
      await prisma.vendor.create({
        data: {
          tenantId,
          type: 'direct',
          companyName: v.companyName,
          contactName: v.contactName,
          email: `sales@${v.companyName.toLowerCase().replace(/[^a-z]+/g, '')}.ph`,
          phone: '+63 2 8888 0000',
          city: 'Quezon City',
          province: 'Metro Manila',
          country: 'PH',
          paymentTerms: v.paymentTerms,
          isActive: true,
        },
      });
    }
  }

  const existing = await prisma.purchaseOrder.count({ where: { tenantId } });
  if (existing > 0) {
    console.log(`  ⏭  Purchasing already seeded (${existing} POs). Skipping.`);
    return;
  }

  const vendorRows = await prisma.vendor.findMany({ where: { tenantId }, select: { id: true }, take: 10 });
  if (vendorRows.length === 0) {
    throw new Error('demo-showcase: no vendors available for purchase orders.');
  }
  const vendorIds = vendorRows.map((v) => v.id);

  const statuses = ['received', 'ordered', 'approved', 'draft'];
  for (let i = 0; i < 4; i++) {
    const itemCount = 2 + (i % 2);
    let subtotal = 0;
    const items: Array<{ description: string; qty: number; unitPrice: number; productId: string }> = [];
    for (let j = 0; j < itemCount; j++) {
      const pIdx = (i + j) % productIds.length;
      const qty = 10 + j * 5;
      const unitPrice = 1200 + i * 300 + j * 150;
      subtotal += qty * unitPrice;
      items.push({ description: `Restock item ${j + 1}`, qty, unitPrice, productId: at(productIds, pIdx) });
    }
    const tax = Math.round(subtotal * 0.12);
    const status = at(statuses, i);
    const isReceived = status === 'received';

    const po = await prisma.purchaseOrder.create({
      data: {
        tenantId,
        poNumber: `DEMO-PO-${num(i + 1)}`,
        vendorId: at(vendorIds, i),
        createdById: adminId,
        approvedById: status === 'draft' ? null : adminId,
        status,
        subtotal: money(subtotal),
        taxAmount: money(tax),
        totalAmount: money(subtotal + tax),
        currency: 'PHP',
        expectedDelivery: daysAgo(-7 + i),
        approvedAt: status === 'draft' ? null : daysAgo(12 - i),
        orderedAt: status === 'draft' ? null : daysAgo(11 - i),
        notes: 'Demo purchase order.',
        items: {
          create: items.map((it, k) => ({
            tenantId,
            productId: it.productId,
            description: it.description,
            unit: 'pcs',
            quantity: money(it.qty),
            unitPrice: money(it.unitPrice),
            totalPrice: money(it.qty * it.unitPrice),
            quantityReceived: isReceived ? money(it.qty) : money(0),
            sortOrder: k,
          })),
        },
      },
      select: { id: true },
    });

    // For received POs: create a goods receipt (+items) and a purchase invoice
    if (isReceived) {
      await prisma.goodsReceipt.create({
        data: {
          tenantId,
          grNumber: `DEMO-GR-${num(i + 1)}`,
          purchaseOrderId: po.id,
          receivedById: adminId,
          status: 'accepted',
          receivedAt: daysAgo(6),
          notes: 'Goods received in full.',
          items: {
            create: items.map((it) => ({
              tenantId,
              productId: it.productId,
              description: it.description,
              quantityExpected: money(it.qty),
              quantityReceived: money(it.qty),
              quantityRejected: money(0),
            })),
          },
        },
      });
      await prisma.purchaseInvoice.create({
        data: {
          tenantId,
          invoiceNumber: `DEMO-PINV-${num(i + 1)}`,
          purchaseOrderId: po.id,
          vendorInvoiceRef: `VINV-${num(9000 + i)}`,
          amount: money(subtotal),
          taxAmount: money(tax),
          totalAmount: money(subtotal + tax),
          currency: 'PHP',
          status: 'paid',
          dueDate: daysAgo(-3),
          paidAt: daysAgo(2),
          notes: 'Settled.',
        },
      });
    }
  }
  console.log('  ✅ Purchasing: 3 vendors, 4 POs (+items), 1 goods receipt, 1 purchase invoice');
}

// ── Projects: Project → Milestone, TimeLog, ProjectExpense, ProjectNote ──────
// Returns the id of the first project (used by inventory disbursement + tasks).

async function seedProjects(
  prisma: PrismaClient,
  tenantId: string,
  adminId: string,
  users: Array<{ id: string }>,
  customerIds: string[],
): Promise<string> {
  const existing = await prisma.project.findFirst({ where: { tenantId }, orderBy: { createdAt: 'asc' }, select: { id: true } });
  if (existing) {
    console.log('  ⏭  Projects already seeded. Skipping.');
    return existing.id;
  }

  const projectDefs = [
    { name: 'Head Office Network Upgrade', status: 'active', priority: 'high', budget: 450000 },
    { name: 'Warehouse Racking Installation', status: 'planning', priority: 'medium', budget: 220000 },
    { name: 'Retail Branch POS Rollout', status: 'completed', priority: 'high', budget: 680000 },
  ];
  let firstProjectId = '';
  for (let i = 0; i < projectDefs.length; i++) {
    const d = at(projectDefs, i);
    const project = await prisma.project.create({
      data: {
        tenantId,
        projectNumber: `DEMO-PRJ-${num(i + 1)}`,
        name: d.name,
        description: `${d.name} — demo showcase project.`,
        customerId: at(customerIds, i),
        managerId: adminId,
        status: d.status,
        priority: d.priority,
        startDate: daysAgo(60 - i * 10),
        targetEndDate: daysAgo(-30 + i * 10),
        actualEndDate: d.status === 'completed' ? daysAgo(3) : null,
        budget: money(d.budget),
        city: 'Makati',
        province: 'Metro Manila',
        milestones: {
          create: [
            { tenantId, name: 'Kickoff & Planning', progress: 100, completedAt: daysAgo(50 - i * 10), dueDate: daysAgo(48 - i * 10), sortOrder: 0 },
            { tenantId, name: 'Execution', progress: d.status === 'completed' ? 100 : 50, dueDate: daysAgo(10), sortOrder: 1 },
            { tenantId, name: 'Handover', progress: d.status === 'completed' ? 100 : 0, dueDate: daysAgo(-20), sortOrder: 2 },
          ],
        },
        notes: {
          create: [
            {
              tenantId,
              createdById: adminId,
              title: 'Site notes',
              content: { type: 'doc', text: `Initial assessment for ${d.name} completed. Awaiting materials.` },
              isPinned: i === 0,
            },
          ],
        },
        expenses: {
          create: [
            { tenantId, type: 'direct', description: 'Site mobilization', amount: money(15000 + i * 5000), date: daysAgo(40 - i * 5) },
            { tenantId, type: 'direct', description: 'Contract labor', amount: money(25000 + i * 5000), date: daysAgo(20 - i * 3) },
          ],
        },
      },
      select: { id: true },
    });
    if (i === 0) firstProjectId = project.id;

    // Time logs against the project (spread across available users)
    for (let k = 0; k < 3; k++) {
      const u = at(users, k);
      const start = daysAgo(15 - i * 3 - k);
      start.setHours(9, 0, 0, 0);
      const end = new Date(start);
      end.setHours(17, 0, 0, 0);
      await prisma.timeLog.create({
        data: {
          tenantId,
          userId: u.id,
          projectId: project.id,
          description: `Work session ${k + 1} on ${d.name}`,
          startTime: start,
          endTime: end,
          durationMinutes: 480,
          isBillable: true,
        },
      });
    }
  }
  console.log('  ✅ Projects: 3 projects (+3 milestones each, notes, expenses), 9 time logs');
  return firstProjectId;
}

// ── Inventory disbursement (needs a project + products) ──────────────────────

async function seedInventoryDisbursement(
  prisma: PrismaClient,
  tenantId: string,
  adminId: string,
  projectId: string,
  productIds: string[],
): Promise<void> {
  const existing = await prisma.inventoryDisbursement.count({ where: { tenantId } });
  if (existing > 0) {
    console.log(`  ⏭  Inventory disbursements already seeded (${existing}). Skipping.`);
    return;
  }
  for (let i = 0; i < 2; i++) {
    const completed = i === 0;
    await prisma.inventoryDisbursement.create({
      data: {
        tenantId,
        disbursementNumber: `DEMO-DISB-${num(i + 1)}`,
        projectId,
        createdById: adminId,
        approvedById: completed ? adminId : null,
        processedById: completed ? adminId : null,
        status: completed ? 'completed' : 'pending',
        approvedAt: completed ? daysAgo(8) : null,
        processedAt: completed ? daysAgo(7) : null,
        notes: 'Materials issued to project site.',
        items: {
          create: [
            { tenantId, productId: at(productIds, i), quantity: money(3 + i), notes: 'For installation' },
            { tenantId, productId: at(productIds, i + 1), quantity: money(5 + i), notes: 'Spare units' },
          ],
        },
      },
    });
  }
  console.log('  ✅ Inventory: 2 disbursements (+items) against the demo project');
}

// ── Tasks: Task → TaskAssignment, plus per-user ToDos ────────────────────────

async function seedTasks(
  prisma: PrismaClient,
  tenantId: string,
  projectId: string,
  users: Array<{ id: string }>,
): Promise<void> {
  if ((await prisma.task.count({ where: { tenantId } })) === 0) {
    const taskDefs = [
      { title: 'Survey the site and take measurements', status: 'done', priority: 'high' },
      { title: 'Procure networking equipment', status: 'in_progress', priority: 'high' },
      { title: 'Install cabling and patch panels', status: 'todo', priority: 'medium' },
      { title: 'Configure switches and test throughput', status: 'todo', priority: 'medium' },
      { title: 'Client walkthrough and sign-off', status: 'blocked', priority: 'low' },
    ];
    for (let i = 0; i < taskDefs.length; i++) {
      const d = at(taskDefs, i);
      const assignee = at(users, i);
      await prisma.task.create({
        data: {
          tenantId,
          projectId,
          title: d.title,
          description: `${d.title} — demo showcase task.`,
          status: d.status,
          priority: d.priority,
          dueDate: daysAgo(-5 + i),
          completedAt: d.status === 'done' ? daysAgo(4) : null,
          estimatedHours: money(4 + i * 2),
          sortOrder: i,
          assignments: {
            create: [{ tenantId, userId: assignee.id }],
          },
        },
      });
    }
    console.log('  ✅ Tasks: 5 tasks (+assignments)');
  } else {
    console.log('  ⏭  Tasks already seeded. Skipping.');
  }

  // Personal ToDos (guard by count)
  if ((await prisma.toDo.count({ where: { tenantId } })) === 0) {
    const todos = [
      'Reply to supplier email',
      'Prepare weekly report',
      'Follow up on pending quotation',
      'Schedule team standup',
    ];
    for (let i = 0; i < todos.length; i++) {
      const u = at(users, i);
      await prisma.toDo.create({
        data: {
          tenantId,
          userId: u.id,
          title: at(todos, i),
          description: 'Personal to-do item.',
          isCompleted: i === 0,
          completedAt: i === 0 ? daysAgo(1) : null,
          dueDate: daysAgo(-2 + i),
          priority: i < 2 ? 'high' : 'medium',
        },
      });
    }
    console.log('  ✅ Tasks: 4 personal to-dos');
  } else {
    console.log('  ⏭  ToDos already seeded. Skipping.');
  }
}

// ── HR/Payroll: Employee, AttendanceRecord, LeaveRequest, CashAdvance,
//    Payroll + Payslip ────────────────────────────────────────────────────────

async function seedHrPayroll(
  prisma: PrismaClient,
  tenantId: string,
  adminId: string,
  users: Array<{ id: string; firstName: string; lastName: string }>,
): Promise<void> {
  // Employees — one per existing user (Employee.userId is @unique). Idempotent upsert.
  const positions = ['Operations Manager', 'Sales Associate', 'Field Technician', 'Accountant', 'Admin Staff'];
  const employeeIds: string[] = [];
  for (let i = 0; i < users.length; i++) {
    const u = at(users, i);
    const emp = await prisma.employee.upsert({
      where: { userId: u.id },
      update: {},
      create: {
        tenantId,
        userId: u.id,
        employeeNumber: `DEMO-EMP-${num(i + 1)}`,
        position: at(positions, i),
        employmentType: 'full_time',
        dateHired: dateAgo(400 + i * 60),
        baseSalary: money(28000 + i * 6000),
        dailyRate: money(Math.round((28000 + i * 6000) / 22)),
        sssNumber: `34-${num(1000000 + i, 7)}-0`,
        philhealthNumber: `PH-${num(2000000 + i, 7)}`,
        pagibigNumber: `PG-${num(3000000 + i, 7)}`,
        tinNumber: `${num(100 + i, 3)}-000-000-000`,
        bankName: 'BPI',
        isActive: true,
      },
      select: { id: true },
    });
    employeeIds.push(emp.id);
  }

  // Attendance — last 5 weekdays per employee (idempotent via @@unique([employeeId,date]))
  if ((await prisma.attendanceRecord.count({ where: { tenantId } })) === 0) {
    let attCount = 0;
    for (const empId of employeeIds) {
      let created = 0;
      let back = 1;
      while (created < 5 && back < 12) {
        const d = dateAgo(back);
        const dow = d.getDay();
        if (dow !== 0 && dow !== 6) {
          const clockIn = new Date(d);
          clockIn.setHours(8, created % 2 === 0 ? 0 : 12, 0, 0);
          const clockOut = new Date(d);
          clockOut.setHours(17, 15, 0, 0);
          await prisma.attendanceRecord.create({
            data: {
              tenantId,
              employeeId: empId,
              date: d,
              clockIn,
              clockOut,
              status: created % 2 === 0 ? 'present' : 'late',
              overtimeMinutes: created === 0 ? 30 : 0,
            },
          });
          created++;
          attCount++;
        }
        back++;
      }
    }
    console.log(`  ✅ HR: ${employeeIds.length} employees, ${attCount} attendance records`);
  } else {
    console.log('  ⏭  Attendance already seeded. Skipping.');
  }

  // One leave request + one cash advance for the first employee
  const firstEmp = employeeIds[0];
  if (firstEmp !== undefined) {
    let hrExtras = 0;
    if ((await prisma.leaveRequest.count({ where: { tenantId } })) === 0) {
      hrExtras++;
      await prisma.leaveRequest.create({
        data: {
          tenantId,
          employeeId: firstEmp,
          type: 'vacation',
          startDate: dateAgo(-10),
          endDate: dateAgo(-8),
          totalDays: '3.0',
          reason: 'Family vacation',
          status: 'approved',
          approvedAt: daysAgo(2),
        },
      });
    }
    if ((await prisma.cashAdvance.count({ where: { tenantId } })) === 0) {
      hrExtras++;
      await prisma.cashAdvance.create({
        data: {
          tenantId,
          employeeId: firstEmp,
          createdById: adminId,
          approvedById: adminId,
          amount: money(5000),
          currency: 'PHP',
          reason: 'Medical emergency',
          status: 'approved',
          approvedAt: daysAgo(9),
          disbursedAt: daysAgo(8),
          totalRecovered: money(0),
        },
      });
    }
    console.log(
      hrExtras > 0
        ? '  ✅ HR: 1 leave request, 1 cash advance'
        : '  ⏭  Leave request / cash advance already seeded. Skipping.',
    );
  }

  // One payroll run with payslips for each employee (idempotent by payrollNumber + @@unique payslip)
  if ((await prisma.payroll.count({ where: { tenantId } })) === 0) {
    const emps = await prisma.employee.findMany({
      where: { tenantId },
      select: { id: true, baseSalary: true },
    });
    let totalGross = 0;
    let totalDed = 0;
    let totalNet = 0;
    const slipData = emps.map((e) => {
      const basic = e.baseSalary ? Number(e.baseSalary) : 28000;
      const gross = basic;
      const sss = Math.round(basic * 0.045);
      const philhealth = Math.round(basic * 0.02);
      const pagibig = 100;
      const tax = Math.round(basic * 0.05);
      const totalDeductions = sss + philhealth + pagibig + tax;
      const net = gross - totalDeductions;
      totalGross += gross;
      totalDed += totalDeductions;
      totalNet += net;
      return { employeeId: e.id, basic, gross, sss, philhealth, pagibig, tax, totalDeductions, net };
    });

    await prisma.payroll.create({
      data: {
        tenantId,
        payrollNumber: 'DEMO-PAY-0001',
        periodStart: dateAgo(30),
        periodEnd: dateAgo(16),
        status: 'paid',
        totalGross: money(totalGross),
        totalDeductions: money(totalDed),
        totalNet: money(totalNet),
        currency: 'PHP',
        processedAt: daysAgo(15),
        paidAt: daysAgo(14),
        notes: 'Semi-monthly payroll (demo).',
        payslips: {
          create: slipData.map((s) => ({
            tenantId,
            employeeId: s.employeeId,
            basicPay: money(s.basic),
            grossPay: money(s.gross),
            sssDeduction: money(s.sss),
            philhealthDeduction: money(s.philhealth),
            pagibigDeduction: money(s.pagibig),
            taxDeduction: money(s.tax),
            totalDeductions: money(s.totalDeductions),
            netPay: money(s.net),
            sssEmployerShare: money(Math.round(s.basic * 0.095)),
            philhealthEmployerShare: money(s.philhealth),
            pagibigEmployerShare: money(100),
          })),
        },
      },
    });
    console.log(`  ✅ HR: 1 payroll run with ${slipData.length} payslips`);
  } else {
    console.log('  ⏭  Payroll already seeded. Skipping.');
  }
}

// ── POS: POSSession → POSSale → POSSaleItem ──────────────────────────────────

async function seedPos(
  prisma: PrismaClient,
  tenantId: string,
  adminId: string,
  productIds: string[],
  customerIds: string[],
): Promise<void> {
  if ((await prisma.pOSSession.count({ where: { tenantId } })) > 0) {
    console.log('  ⏭  POS already seeded. Skipping.');
    return;
  }

  // Need product prices to build realistic sale lines
  const products = await prisma.product.findMany({
    where: { tenantId, id: { in: productIds } },
    select: { id: true, name: true, tier1Price: true },
  });
  const priceOf = (id: string): number => {
    const p = products.find((x) => x.id === id);
    return p?.tier1Price ? Number(p.tier1Price) : 500;
  };
  const nameOf = (id: string): string => products.find((x) => x.id === id)?.name ?? 'Item';

  // One closed session + one open session
  for (let s = 0; s < 2; s++) {
    const isClosed = s === 0;
    const opened = daysAgo(1 - s);
    opened.setHours(8, 0, 0, 0);
    const session = await prisma.pOSSession.create({
      data: {
        tenantId,
        sessionNumber: `DEMO-POS-${num(s + 1)}`,
        userId: adminId,
        openedAt: opened,
        openingBalance: money(2000),
        status: isClosed ? 'closed' : 'open',
        closedAt: isClosed ? daysAgo(1) : null,
        notes: isClosed ? 'End of day cash counted.' : 'Active register.',
      },
      select: { id: true },
    });

    const saleCount = isClosed ? 3 : 1;
    let sessionTotal = 0;
    const methods = ['cash', 'gcash', 'card'];
    for (let i = 0; i < saleCount; i++) {
      const lineCount = 1 + (i % 2);
      let subtotal = 0;
      const items: Array<{ productId: string; description: string; qty: number; unitPrice: number }> = [];
      for (let j = 0; j < lineCount; j++) {
        const pid = at(productIds, (s + i + j) % productIds.length);
        const qty = 1 + j;
        const unitPrice = priceOf(pid);
        subtotal += qty * unitPrice;
        items.push({ productId: pid, description: nameOf(pid), qty, unitPrice });
      }
      const tax = Math.round(subtotal * 0.12);
      const total = subtotal + tax;
      const method = at(methods, i);
      const paid = method === 'cash' ? Math.ceil(total / 100) * 100 : total;
      sessionTotal += total;
      await prisma.pOSSale.create({
        data: {
          tenantId,
          saleNumber: `DEMO-SALE-${num(s * 10 + i + 1)}`,
          sessionId: session.id,
          customerId: i === 0 ? at(customerIds, 0) : null,
          subtotal: money(subtotal),
          taxAmount: money(tax),
          discountAmount: money(0),
          totalAmount: money(total),
          amountPaid: money(paid),
          changeAmount: money(paid - total),
          paymentMethod: method,
          status: 'completed',
          currency: 'PHP',
          items: {
            create: items.map((it) => ({
              tenantId,
              productId: it.productId,
              description: it.description,
              quantity: money(it.qty),
              unitPrice: money(it.unitPrice),
              totalPrice: money(it.qty * it.unitPrice),
            })),
          },
        },
      });
    }

    if (isClosed) {
      const expected = 2000 + sessionTotal;
      await prisma.pOSSession.update({
        where: { id: session.id },
        data: {
          closingBalance: money(expected),
          expectedBalance: money(expected),
          discrepancy: money(0),
        },
      });
    }
  }
  console.log('  ✅ POS: 2 sessions (1 closed, 1 open) with 4 sales (+items)');
}

// ── Support: SupportTicket → TicketComment ───────────────────────────────────

async function seedSupport(
  prisma: PrismaClient,
  tenantId: string,
  users: Array<{ id: string }>,
): Promise<void> {
  if ((await prisma.supportTicket.count({ where: { tenantId } })) > 0) {
    console.log('  ⏭  Support already seeded. Skipping.');
    return;
  }
  const tickets = [
    { title: 'Cannot log in to portal', category: 'account', priority: 'high', status: 'open' },
    { title: 'Invoice PDF not generating', category: 'billing', priority: 'medium', status: 'in_progress' },
    { title: 'Request to add new warehouse', category: 'feature', priority: 'low', status: 'resolved' },
    { title: 'Stock count mismatch', category: 'inventory', priority: 'high', status: 'closed' },
  ];
  for (let i = 0; i < tickets.length; i++) {
    const t = at(tickets, i);
    const creator = at(users, i);
    const commenter = at(users, (i + 1) % users.length);
    await prisma.supportTicket.create({
      data: {
        tenantId,
        ticketNumber: `DEMO-TKT-${num(i + 1)}`,
        createdById: creator.id,
        assignedToId: null,
        title: t.title,
        description: `${t.title}. Reported during demo showcase.`,
        category: t.category,
        priority: t.priority,
        status: t.status,
        resolvedAt: t.status === 'resolved' || t.status === 'closed' ? daysAgo(2) : null,
        closedAt: t.status === 'closed' ? daysAgo(1) : null,
        comments: {
          create: [
            { tenantId, userId: creator.id, content: 'Initial report with details.', isInternal: false },
            { tenantId, userId: commenter.id, content: 'Looking into this now.', isInternal: true },
          ],
        },
      },
    });
  }
  console.log('  ✅ Support: 4 tickets (+2 comments each)');
}

// ── E-commerce: EcommerceOrder → EcommerceOrderItem ──────────────────────────

async function seedEcommerce(
  prisma: PrismaClient,
  tenantId: string,
  customerIds: string[],
  productIds: string[],
): Promise<void> {
  if ((await prisma.ecommerceOrder.count({ where: { tenantId } })) > 0) {
    console.log('  ⏭  E-commerce already seeded. Skipping.');
    return;
  }
  const products = await prisma.product.findMany({
    where: { tenantId, id: { in: productIds } },
    select: { id: true, name: true, tier1Price: true },
  });
  const priceOf = (id: string): number => {
    const p = products.find((x) => x.id === id);
    return p?.tier1Price ? Number(p.tier1Price) : 500;
  };
  const nameOf = (id: string): string => products.find((x) => x.id === id)?.name ?? 'Item';

  const orderStatuses = ['delivered', 'shipped', 'processing', 'pending'];
  const payStatuses = ['paid', 'paid', 'pending', 'pending'];
  for (let i = 0; i < 4; i++) {
    const lineCount = 1 + (i % 3);
    let subtotal = 0;
    const items: Array<{ productId: string; description: string; qty: number; unitPrice: number }> = [];
    for (let j = 0; j < lineCount; j++) {
      const pid = at(productIds, (i + j) % productIds.length);
      const qty = 1 + j;
      const unitPrice = priceOf(pid);
      subtotal += qty * unitPrice;
      items.push({ productId: pid, description: nameOf(pid), qty, unitPrice });
    }
    const tax = Math.round(subtotal * 0.12);
    const shipping = 150;
    const total = subtotal + tax + shipping;
    const status = at(orderStatuses, i);
    await prisma.ecommerceOrder.create({
      data: {
        tenantId,
        orderNumber: `DEMO-ECO-${num(i + 1)}`,
        customerId: at(customerIds, i),
        status,
        subtotal: money(subtotal),
        taxAmount: money(tax),
        shippingAmount: money(shipping),
        discountAmount: money(0),
        totalAmount: money(total),
        currency: 'PHP',
        paymentMethod: 'xendit',
        paymentStatus: at(payStatuses, i),
        shippingAddress: { line1: '123 Ayala Ave', city: 'Makati', province: 'Metro Manila', country: 'PH', postalCode: '1226' },
        trackingNumber: status === 'shipped' || status === 'delivered' ? `TRK-${num(50000 + i)}` : null,
        items: {
          create: items.map((it) => ({
            tenantId,
            productId: it.productId,
            description: it.description,
            quantity: money(it.qty),
            unitPrice: money(it.unitPrice),
            totalPrice: money(it.qty * it.unitPrice),
            tierApplied: 'tier1',
          })),
        },
      },
    });
  }
  console.log('  ✅ E-commerce: 4 orders (+items)');
}

// ── Repairs: JobOrder → JobOrderPart, JobOrderServiceLine ────────────────────

async function seedRepairs(
  prisma: PrismaClient,
  tenantId: string,
  adminId: string,
  users: Array<{ id: string }>,
  customerIds: string[],
  productIds: string[],
): Promise<void> {
  if ((await prisma.jobOrder.count({ where: { tenantId } })) > 0) {
    console.log('  ⏭  Repairs already seeded. Skipping.');
    return;
  }
  const technicianId = at(users, users.length > 1 ? 1 : 0).id;
  const jobs = [
    { title: 'Laptop won\'t power on', deviceType: 'Laptop', deviceBrand: 'Lenovo', deviceModel: 'ThinkPad E14', issue: 'No power, suspected faulty adapter', status: 'completed', labor: 800 },
    { title: 'Printer paper jam recurring', deviceType: 'Printer', deviceBrand: 'Epson', deviceModel: 'L3210', issue: 'Frequent paper jams', status: 'in_progress', labor: 500 },
    { title: 'Monitor flickering display', deviceType: 'Monitor', deviceBrand: 'Dell', deviceModel: 'S2421', issue: 'Screen flickers intermittently', status: 'received', labor: 0 },
  ];
  for (let i = 0; i < jobs.length; i++) {
    const j = at(jobs, i);
    const isCompleted = j.status === 'completed';
    const partTotal = 650 + i * 100;
    const laborAmount = j.labor;
    await prisma.jobOrder.create({
      data: {
        tenantId,
        jobOrderNumber: `DEMO-JO-${num(i + 1)}`,
        customerId: at(customerIds, i),
        createdById: adminId,
        technicianId,
        title: j.title,
        description: `${j.title} — intake for repair.`,
        deviceType: j.deviceType,
        deviceBrand: j.deviceBrand,
        deviceModel: j.deviceModel,
        serialNumber: `SN-${num(700000 + i, 7)}`,
        reportedIssue: j.issue,
        diagnosis: isCompleted ? 'Faulty component replaced and unit tested.' : null,
        status: j.status,
        priority: i === 0 ? 'high' : 'medium',
        estimatedCost: money(partTotal + laborAmount),
        actualCost: isCompleted ? money(partTotal + laborAmount) : null,
        laborCost: money(laborAmount),
        currency: 'PHP',
        warranty: isCompleted ? '30 days parts & labor' : null,
        completedAt: isCompleted ? daysAgo(2) : null,
        releasedAt: isCompleted ? daysAgo(1) : null,
        parts: {
          create: [
            {
              tenantId,
              productId: at(productIds, i),
              description: 'Replacement part',
              quantity: money(1),
              unitPrice: money(partTotal),
              totalPrice: money(partTotal),
              isFromInventory: true,
            },
          ],
        },
        serviceLines: {
          create: [
            {
              tenantId,
              description: 'Diagnostic & repair labor',
              hours: money(2),
              rate: money(laborAmount > 0 ? laborAmount / 2 : 250),
              amount: money(laborAmount > 0 ? laborAmount : 500),
              sortOrder: 0,
            },
          ],
        },
      },
    });
  }
  console.log('  ✅ Repairs: 3 job orders (+parts, +service lines)');
}

// ── Banking: FundSource → FundTransaction ────────────────────────────────────

async function seedBanking(
  prisma: PrismaClient,
  tenantId: string,
  adminId: string,
): Promise<void> {
  if ((await prisma.fundSource.count({ where: { tenantId } })) > 0) {
    console.log('  ⏭  Banking already seeded. Skipping.');
    return;
  }
  const sources = [
    { name: 'Cash on Hand', type: 'cash_on_hand', opening: 50000 },
    { name: 'BPI Corporate Checking', type: 'bank', bankName: 'BPI', accountNumber: '1234-5678-90', opening: 850000 },
    { name: 'GCash Business Wallet', type: 'e_wallet', opening: 120000 },
  ];
  for (let s = 0; s < sources.length; s++) {
    const src = at(sources, s);
    // Build a small ledger; running balance walks forward from opening.
    const txns = [
      { type: 'deposit', amount: 30000, category: 'sales', desc: 'Sales deposit' },
      { type: 'withdrawal', amount: 12000, category: 'expense', desc: 'Supplier payment' },
      { type: 'income', amount: 18000, category: 'sales', desc: 'Cash sales remittance' },
      { type: 'expense', amount: 6500, category: 'operations', desc: 'Utility bill' },
    ];
    let running = src.opening;
    const txnData = txns.map((t, i) => {
      const signed = t.type === 'deposit' || t.type === 'income' ? t.amount : -t.amount;
      running += signed;
      return {
        tenantId,
        type: t.type,
        amount: money(t.amount),
        runningBalance: money(running),
        category: t.category,
        description: t.desc,
        createdById: adminId,
        transactionDate: daysAgo(20 - s * 3 - i),
      };
    });

    await prisma.fundSource.create({
      data: {
        tenantId,
        name: src.name,
        type: src.type,
        bankName: src.bankName ?? null,
        accountNumber: src.accountNumber ?? null,
        currentBalance: money(running),
        currency: 'PHP',
        isActive: true,
        transactions: { create: txnData },
      },
    });
  }
  console.log('  ✅ Banking: 3 fund sources (+4 transactions each)');
}

// ── Invoicing + Expenses: MIXED statuses so every dashboard tile populates ────
// Dashboard (dashboard/page.tsx) derives its tiles by status:
//   • Outstanding      = invoices status sent|partially_paid|overdue  (Σ balance)
//   • Paid Invoices    = invoices status paid                          (Σ totalAmount)
//   • Pending Expenses = expenses status pending                       (Σ amount)
//   • Recent lists     = latest 5 invoices / 5 expenses (any status)
// So we seed a realistic spread across all of those, not just paid/approved.
async function seedInvoicesExpenses(
  prisma: PrismaClient,
  tenantId: string,
  adminId: string,
  customerIds: string[],
): Promise<void> {
  if ((await prisma.invoice.count({ where: { tenantId } })) > 0) {
    console.log('  ⏭  Invoices already seeded. Skipping.');
    return;
  }

  const TAX = 0.12; // PH VAT
  const offsetDate = (offset: number): Date => {
    const d = new Date();
    d.setDate(d.getDate() + offset); // +future / -past
    d.setHours(9, 0, 0, 0);
    return d;
  };

  type InvSpec = {
    status: 'paid' | 'sent' | 'partially_paid' | 'overdue';
    base: number;
    dueOffset: number;
    paidFraction?: number;
    paidDaysAgo?: number;
  };
  const invoiceSpecs: readonly InvSpec[] = [
    { status: 'paid', base: 45000, dueOffset: -25, paidDaysAgo: 20 },
    { status: 'paid', base: 78000, dueOffset: -12, paidDaysAgo: 8 },
    { status: 'sent', base: 32000, dueOffset: 10 },
    { status: 'sent', base: 56000, dueOffset: 20 },
    { status: 'partially_paid', base: 90000, dueOffset: 5, paidFraction: 0.4 },
    { status: 'overdue', base: 41000, dueOffset: -8 },
  ];

  const round2 = (n: number): number => Math.round(n * 100) / 100;

  let invCount = 0;
  for (let i = 0; i < invoiceSpecs.length; i++) {
    const s = at(invoiceSpecs, i);
    const subtotal = s.base;
    const tax = round2(s.base * TAX);
    const total = round2(subtotal + tax);
    let amountPaid = 0;
    let paidAt: Date | null = null;
    if (s.status === 'paid') {
      amountPaid = total;
      paidAt = daysAgo(s.paidDaysAgo ?? 10);
    } else if (s.status === 'partially_paid') {
      amountPaid = round2(total * (s.paidFraction ?? 0.5));
    }
    const balance = round2(total - amountPaid);
    await prisma.invoice.create({
      data: {
        tenantId,
        invoiceNumber: `DEMO-INV-${num(i + 1)}`,
        customerId: at(customerIds, i),
        createdById: adminId,
        status: s.status,
        subtotal: money(subtotal),
        taxAmount: money(tax),
        totalAmount: money(total),
        amountPaid: money(amountPaid),
        balance: money(balance),
        currency: 'PHP',
        dueDate: offsetDate(s.dueOffset),
        issuedAt: offsetDate(s.dueOffset - 15),
        paidAt,
        lineItems: [
          { description: 'Professional services', quantity: 1, unitPrice: money(round2(subtotal * 0.6)), amount: money(round2(subtotal * 0.6)) },
          { description: 'Materials & supplies', quantity: 1, unitPrice: money(round2(subtotal * 0.4)), amount: money(round2(subtotal * 0.4)) },
        ],
        notes: 'Demo invoice — auto-seeded showcase data.',
      },
    });
    invCount++;
  }
  console.log(`  ✅ Invoicing: ${invCount} invoices (paid + outstanding mix)`);

  // Expenses — includes 'pending' so the "Pending Expenses" tile lights up.
  const cats = await prisma.expenseCategory.findMany({
    where: { tenantId },
    orderBy: { sortOrder: 'asc' },
    select: { id: true },
  });
  if (cats.length === 0) {
    console.log('  ⏭  No expense categories — skipping expenses.');
    return;
  }
  const catIds = cats.map((c) => c.id);
  type ExpSpec = { status: 'pending' | 'approved' | 'reimbursed'; desc: string; amount: number; dateDaysAgo: number };
  const expenseSpecs: readonly ExpSpec[] = [
    { status: 'pending', desc: 'Office supplies restock — Q3', amount: 8500, dateDaysAgo: 3 },
    { status: 'pending', desc: 'Team offsite transportation', amount: 12400, dateDaysAgo: 5 },
    { status: 'pending', desc: 'Cloud hosting subscription (monthly)', amount: 15900, dateDaysAgo: 2 },
    { status: 'approved', desc: 'Client meeting meals', amount: 4200, dateDaysAgo: 12 },
    { status: 'approved', desc: 'Courier & logistics', amount: 6750, dateDaysAgo: 18 },
    { status: 'reimbursed', desc: 'Conference registration', amount: 9800, dateDaysAgo: 30 },
  ];
  let expCount = 0;
  for (let i = 0; i < expenseSpecs.length; i++) {
    const e = at(expenseSpecs, i);
    const approved = e.status === 'approved' || e.status === 'reimbursed';
    await prisma.expense.create({
      data: {
        tenantId,
        expenseNumber: `DEMO-EXP-${num(i + 1)}`,
        expenseCategoryId: at(catIds, i),
        createdById: adminId,
        approvedById: approved ? adminId : null,
        approvedAt: approved ? daysAgo(e.dateDaysAgo - 1) : null,
        description: e.desc,
        amount: money(e.amount),
        currency: 'PHP',
        date: dateAgo(e.dateDaysAgo),
        status: e.status,
        notes: 'Demo expense — auto-seeded showcase data.',
      },
    });
    expCount++;
  }
  console.log(`  ✅ Expenses: ${expCount} (pending + approved + reimbursed mix)`);
}
