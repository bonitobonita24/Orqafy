-- Template-alignment §2 (Shopix parity): Brand + MerchContent models,
-- ecommerce fields on Product, imageUrl on Category. Additive-only —
-- no DROP/RENAME/ALTER-narrowing statements. Hand-curated: `prisma migrate
-- dev --create-only` also emitted a large set of unrelated statements
-- (tenant_id SET NOT NULL across ~50 tables, categories_slug_key ->
-- categories_tenant_id_slug_key rename, mobile_sync_ops index rename)
-- reflecting pre-existing drift between the dev DB and migration history
-- that predates this change; those statements are intentionally excluded
-- here and reported separately, not fixed as part of this task.

-- CreateEnum
CREATE TYPE "MerchContentKind" AS ENUM ('announcement', 'hero', 'promo');

-- AlterTable: Category gains storefront image
ALTER TABLE "categories" ADD COLUMN "image_url" TEXT;

-- AlterTable: Product gains ecommerce/storefront fields
ALTER TABLE "products"
  ADD COLUMN "brand_id" TEXT,
  ADD COLUMN "compare_at_price" DECIMAL(12,2),
  ADD COLUMN "ecommerce_slug" TEXT,
  ADD COLUMN "ecommerce_specs" JSONB,
  ADD COLUMN "is_featured" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "brands" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logo_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merch_content" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "kind" "MerchContentKind" NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "cta_label" TEXT,
    "cta_href" TEXT,
    "image_url" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merch_content_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "brands_tenant_id_idx" ON "brands"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "brands_tenant_id_name_key" ON "brands"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "merch_content_tenant_id_kind_idx" ON "merch_content"("tenant_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "merch_content_tenant_id_kind_title_key" ON "merch_content"("tenant_id", "kind", "title");

-- CreateIndex
CREATE INDEX "products_brand_id_idx" ON "products"("brand_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_tenant_id_ecommerce_slug_key" ON "products"("tenant_id", "ecommerce_slug");

-- AddForeignKey
ALTER TABLE "brands" ADD CONSTRAINT "brands_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merch_content" ADD CONSTRAINT "merch_content_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;
