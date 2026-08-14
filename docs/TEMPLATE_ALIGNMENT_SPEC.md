# Template Alignment Spec — Shopix (storefront) + RestroPOS (POS)

> Status: **HELD by owner (2026-08-14 eve)** — spec reviewed; sub-decisions D-i (demo
> catalog reshape: YES) + D-ii (store landing: YES) CONFIRMED; build NOT authorized yet.
> Waiting on explicit owner go before P1. Originally: DRAFT for owner approval. Product-attribute + content-model alignment so our real
> inventory data can feed the vendored templates' UI. Sources: full audits of
> `starter/shopix/` + `starter/restropos/` (2026-08-14). Additive-only — no existing field
> is renamed/removed. HARD HOLD throughout.

## 1. What each template's UI consumes vs what we have

### Product card/detail (Shopix) — field map

| Shopix field | Ours today | Plan |
|---|---|---|
| `image` + `images[4]` | `ecommerceImageUrls Json` ✅ exists, seeded with placeholders | **Seed real photos** (from licensed Shopix assets) |
| `brand` (card headline!) | ❌ | **NEW `Brand` model** (tenant-scoped: name, logoUrl, isActive) + `Product.brandId?` |
| `price` | tier prices ✅ | keep (storefront already picks display price) |
| `originalPrice` + `discount%` | ❌ | **NEW `Product.compareAtPrice Decimal?`** — strikethrough + "% OFF" **derived** (never stored, can't drift) |
| `isNew` | ❌ (manual bool in Shopix) | **derive from `createdAt` < 30d** — zero schema |
| `isPopular` | ❌ | **NEW `Product.isFeatured Boolean @default(false)`** |
| slug URLs (`/product/noise-buds-x-prime`) | cuid URLs | **NEW `Product.ecommerceSlug String?`** (unique per tenant, derived from name; cuid fallback) |
| `highlights[]` (spec table) | `metadata`/`dimensions` Json | **NEW `Product.ecommerceSpecs Json?`** (`[{label,value}]`) — optional per product |
| `colors[]`, `sizes[]` (variants) | ❌ | **SKIP v1** (real variant system is its own project; Shopix only has them on 5/40 products) |
| `rating`, `reviewCount`, `reviews[]` | ❌ | **SKIP** (no fake stars — standing honest-data rule; needs a real review feature later) |
| stock | real `WarehouseStock` ✅ | **BETTER than Shopix** (theirs is hardcoded "In Stock") — wire real availability |
| wishlist | ❌ | client-side localStorage store (like cart) — zero schema |
| "Add to Cart"/"Go to Cart" state | cart store ✅ | adopt the toggle behavior |

### Marketing/banner content (Shopix) — currently hardcoded/fake-db in the template

| Shopix content | Their model | Plan |
|---|---|---|
| Announcement bar | `{name,color}[]` | **NEW `MerchContent` model** (one tenant-scoped table for all of these): `kind` enum (`announcement` \| `hero` \| `promo`), `title`, `subtitle?`, `ctaLabel?`, `ctaHref?`, `imageUrl?`, `sortOrder`, `isActive`, `startsAt?`, `endsAt?` |
| Hero banners | `HeroProduct` (w/ Tailwind classes baked in data — bad; we keep presentation in code) | ↑ same table, `kind: hero` |
| Deals of the Day + countdown | **hardcoded countdown, no end-time field** | ↑ `kind: promo` + real `endsAt` → honest countdown |
| Category tiles (circle image + name) | `{name,image,href}` | **NEW `Category.imageUrl String?`** — tiles derive from real categories |
| Brand logo marquee | `{name,logo}` | derives from the new `Brand` model (logoUrl) |
| Benefits row / CTA / megamenu promos | hardcoded JSX | keep hardcoded (presentation, not data) |

### POS (RestroPOS) — main sale screen only (tables/seating/KDS/reservations excluded per owner)

| RestroPOS piece | Ours today | Plan |
|---|---|---|
| Product grid card (image, name, price, qty badge, hover stepper) | POS new-sale exists (97-line page), no images | **UI re-graft** of new-sale onto RestroPOS layout; card image = first `ecommerceImageUrls` entry (fallback icon — template has no fallback, we add one) |
| Category tab chips | real `Category` ✅ | wire by `categoryId` (template joins by name string — we do it properly) |
| Search + filters | — | client-side name/SKU search per template |
| Right panel cart + totals | our pos router (subtotal/tax/discount) ✅ | re-skin; keep our math |
| Checkout dialog (payment-method buttons) | `cash/gcash/maya/card/credit` ✅ (richer than template's 4) | re-skin w/ our 5 tenders; keep cash-tendered/change (ours; template lacks it) |
| Receipt (their "KOT" dialog) | ❌ printed receipt | **adopt as Receipt** (rename, drop covers/table), print via their pattern |
| Addon/modifier engine (single/multi, min/max, required) | ❌ | **DEFER** — generic + good, but retail options = later feature |
| Coupons | our `discountAmount` ✅ | keep ours; template coupon engine deferred |
| FoodType (veg/…), tables, covers, KDS | n/a | **SKIP** (restaurant-only) |
| Stock link | real `WarehouseStock` ✅ | out-of-stock disabling on the card — **better than template** (theirs has none) |

## 2. Schema delta (one additive migration)

```prisma
model Brand {            // NEW — tenant-scoped
  id/tenantId/name/logoUrl?/isActive/sortOrder/timestamps
  @@unique([tenantId, name])
}
model MerchContent {     // NEW — tenant-scoped storefront content
  id/tenantId/kind(announcement|hero|promo)/title/subtitle?/ctaLabel?/ctaHref?/
  imageUrl?/sortOrder/isActive/startsAt?/endsAt?/timestamps
}
// Product — 4 new optional fields:
brandId? → Brand · compareAtPrice Decimal? · isFeatured Boolean @default(false) ·
ecommerceSlug String? (@@unique [tenantId, ecommerceSlug]) · ecommerceSpecs Json?
// Category — 1 new field:
imageUrl String?
```
Derived (no fields): `discount% = round((1 − price/compareAtPrice)·100)` · `isNew = createdAt < 30d` · availability from `WarehouseStock`.

## 3. Seed plan (demo tenant)

Enrich the demo catalog to ~24 products across ~6 categories using the **licensed Shopix
assets** (card webp 1024², gallery 3:4) copied into our storage path — real photos, brands
(w/ logos), compare-at prices (₱), featured flags, specs, category tile images, plus
announcement/hero/promo MerchContent rows (promo gets a real `endsAt`). Existing 8 demo
products keep their SKUs/stock; new ones get stock + purchase history so POS/inventory
stay coherent. NEVER touches non-demo tenants.

## 4. Build phases (each dev-first, verified, committed on the branch)

- **P1 Schema + migration + seed** (Brand, MerchContent, Product/Category fields, demo seed w/ real photos)
- **P2 Storefront re-graft onto Shopix components** (catalog card/grid + filter sidebar [category/brand/price/discount] + product detail [gallery/specs/related] + wishlist + cart/checkout chrome + store landing w/ hero/categories/deals/brand marquee + announcement bar) — keeps our tRPC/Prisma/SEO/Turnstile wiring verbatim
- **P3 POS re-graft onto RestroPOS main screen** (grid+card+right panel+checkout dialog+receipt; our router math; KEEP/SKIP per audit)
- **P4 QA + fidelity re-baseline** (full walk, anchors extended, baselines re-captured)

Effort: L (P1 ~1 session · P2 ~2 · P3 ~1 · P4 ~0.5). Today's committed restyle work carries
forward (middleware fix, anchors, footer, checkout/track chrome); the catalog/detail cards
from this afternoon get superseded by the Shopix components in P2 — expected and fine.

## 5. Open sub-decisions (defaults if unanswered)

- **D-i Demo catalog reshape** — default: YES, adopt ~24 Shopix-style products for the demo tenant (it's a demo; richer look).
- **D-ii Store landing page** — Shopix has a merch home; our store opens at the catalog. Default: ADD `/{slug}/store` landing (hero/categories/deals) since MerchContent exists anyway.
- **D-iii POS timing** — default: after storefront (P3 as listed).
- **D-iv Reviews/ratings & variants (colors/sizes)** — OUT of this effort; logged as future features.
