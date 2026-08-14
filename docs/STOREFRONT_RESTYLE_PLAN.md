# Storefront Restyle — Execution Plan (PLAN-FIRST, awaiting owner approval)

> **Status:** DRAFT for approval. Nothing is built until the owner okays this plan.
> **Scope:** public customer storefront `(tenant)/[slug]/store/*` only. UI/design layer.
> **Discipline:** INHERIT-not-REPLACE on the orqafy theme (same as Phase 5 landing/auth grafts).
> **Gate:** dev-first · HARD HOLD (no staging/prod deploy without explicit owner word).
> Carried from AdminCN adoption (2026-08-08): storefront wants a different design language than the
> admin ERP, and AdminCN ships no shop scaffold — the studio Pro **eCommerce** block category fills it.

---

## 1. Route surface (ground truth — 6 files, 703 lines, 0 fidelity anchors today)

| # | Route file | Kind | Lines | Current shape |
|---|---|---|---|---|
| S0 | `store/layout.tsx` | server shell | 44 | header (Shop / Track order / CartDrawer) + `CartProvider`, `max-w-6xl` |
| S1 | `store/products/page.tsx` | server (Prisma) | 280 | product catalog grid + search + category filter + pagination, SEO `index:true` |
| S2 | `store/products/[id]/page.tsx` | server (Prisma) | 200 | product detail + `AddToCartButton`, SEO `index:true` + generateMetadata |
| S3 | `store/checkout/page.tsx` | server → client `CheckoutForm` | 32 | thin shell, `robots noindex`, delegates form |
| S4 | `store/orders/track/page.tsx` | page | 128 | order-lookup + status view, utility (noindex) |
| S5 | `components/cart/cart-drawer.tsx` | client | — | Sheet + `useCart` store + hugeicons shim |

**Wiring boundary (non-negotiable — kept verbatim):** Prisma reads, `generateMetadata`/SEO
contracts (Rule 35), `CartProvider`/`useCart` store, `AddToCartButton`, `CheckoutForm` logic,
tRPC/order-submit paths. **Only presentational JSX is re-grafted.**

---

## 2. Route → studio Pro eCommerce block map (all block names VERIFIED present in the registry)

| # | Route | Primary block(s) | Graft approach |
|---|---|---|---|
| S0 | storefront shell | `announcement-banner` (opt-in, §4 D-1) · `mega-footer` | Add a themed footer + optional top announcement bar; keep header nav + CartDrawer trigger logic. |
| S1 | catalog | `product-list` + `category-filter` | Replace grid/card + filter presentation; keep the server Prisma query, search param wiring, pagination. Optional `product-quick-view` dialog (opt-in). |
| S2 | product detail | `product-overview` (or `-2`) + `product-reviews` | Replace gallery/detail layout; keep Prisma load + `AddToCartButton`. Reviews block = presentational only unless a reviews model exists (§4 D-2). |
| S3 | checkout | `checkout-page` + `order-summary` | Restyle `CheckoutForm` fields + summary panel; keep all submit/validation logic + payment-on-delivery copy. |
| S4 | order track | (no eCommerce block) | Restyle with existing themed Card/Badge primitives + `order-summary` chrome for the status panel. |
| S5 | cart drawer | `shopping-cart` | Apply block's line-item/qty/subtotal styling inside the existing `Sheet`; keep `useCart` handlers + hugeicons. |

Blocks NOT used this pass: `product-category`, `offer-modal`, `gift-card` (no matching surface).

---

## 3. Per-page execution sequence (one page per unit; dev-first; each verified before next)

Each unit follows the Phase-5 graft discipline exactly:
1. `mcp get-block-meta-content` → pull the block source.
2. Graft presentational markup into the page; **re-point every icon to the `@/components/ui/icons` hugeicons shim** (re-ban lucide — 0 refs after).
3. Delete any demo routes / demo data the block ships (Phase-5 lesson: stock blocks reimport lucide + install live demo routes).
4. Keep real tRPC/Prisma wiring + SEO contract intact.
5. `pnpm typecheck` + `pnpm build` green; visual QA the page in dev (Playwright/DOM).
6. Commit per page on `feat/storefront-restyle` (LOCAL, HARD HOLD).

**Order:** S5 cart drawer → S1 catalog → S2 product detail → S3 checkout → S4 order track → S0 shell/footer.
(Cart first because it's shared chrome touched by every add-to-cart flow.)

**Fidelity anchors (Rule 31):** storefront has **0** `data-fdl` anchors today. After the grafts land and
the look is approved, add anchors to the 5 storefront pages + capture Playwright baselines
(`design:fidelity --update-baseline`), extending the armed gate to the storefront — same as landing/login
got in Phase 5. This is the LAST step, post-approval of the built look.

**Effort:** M · ~2–3 sessions (cart+catalog+detail, then checkout+track+shell+anchors).

---

## 4. Sub-decisions folded in (defaults chosen; override any)

- **D-1 Announcement banner** — include a top announcement bar on the shell? Default: **skip** (no content source; add later if wanted).
- **D-2 Product reviews** — `product-reviews` block needs a reviews data model. Orqafy has none today. Default: **presentational placeholder OFF** — omit the reviews section rather than ship fake stars (avoids the Phase-5 demo-data trap). Add as a real feature later if desired.
- **D-3 Quick-view** — add the `product-quick-view` modal to the catalog? Default: **skip v1** (detail page already covers it); can add if you want faster browsing.
- **D-4 Look preferences** — default: **"match the new theme"** (orqafy oklch zinc palette, Source Code Pro mono, current radius/shadow tokens). Tell me if the shop should read warmer / more retail than the ERP.

---

## 5. Guardrails (standing)
- INHERIT-not-REPLACE — Rule-12 tokens win value conflicts; blocks extend, never replace, the design system.
- Rule 35 SEO contract preserved per route (catalog+detail stay `index:true`; checkout/track stay noindex).
- Branch `feat/storefront-restyle`, Conventional Commits, LOCAL only. HARD HOLD — no push/deploy.
- Verify each page against real dev runtime before advancing (never a self-report).
- Prod stays on its current version untouched throughout.
