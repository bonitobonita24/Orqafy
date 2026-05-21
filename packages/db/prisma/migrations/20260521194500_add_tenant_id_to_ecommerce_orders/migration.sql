-- Batch 21c (Direction F complete): per-tenant Xendit refactor needs EcommerceOrder.tenantId
-- to resolve `xenditPaymentId → tenantId → TenantXenditConfig` in the webhook handler.
-- Three-stage backfill: nullable ADD → UPDATE → SET NOT NULL → FK → INDEX.

-- 1. Add nullable column so existing rows survive the ADD.
ALTER TABLE "ecommerce_orders" ADD COLUMN "tenant_id" TEXT;

-- 2. Backfill existing rows to the oldest tenant. Deterministic and idempotent.
--    Edge case: zero tenants AND zero orders → no-op, step 3 succeeds vacuously.
--    Edge case: zero tenants AND any orders → step 3 will FAIL LOUDLY (caller must seed).
UPDATE "ecommerce_orders"
   SET "tenant_id" = (SELECT id FROM "tenants" ORDER BY "created_at" ASC LIMIT 1)
 WHERE "tenant_id" IS NULL;

-- 3. Enforce NOT NULL going forward.
ALTER TABLE "ecommerce_orders" ALTER COLUMN "tenant_id" SET NOT NULL;

-- 4. Foreign key.
ALTER TABLE "ecommerce_orders"
  ADD CONSTRAINT "ecommerce_orders_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5. Index for tenant-scoped queries (admin order lists, FK count in admin-xendit-config delete).
CREATE INDEX "ecommerce_orders_tenant_id_idx" ON "ecommerce_orders"("tenant_id");
