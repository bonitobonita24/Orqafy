-- Batch 26 Direction I: PurchaseOrder.tenantId parity.
-- Closes the per-tenant gap on the purchasing surface — same shape as Batch 21c did for ecommerce_orders.
-- Five-stage: nullable ADD → backfill from tenants → SET NOT NULL → FK → INDEX.

-- 1. Add nullable column so existing rows survive the ADD.
ALTER TABLE "purchase_orders" ADD COLUMN "tenant_id" TEXT;

-- 2. Backfill existing rows to the oldest tenant. Deterministic and idempotent.
--    Edge case: zero tenants AND zero POs → no-op, step 3 succeeds vacuously.
--    Edge case: zero tenants AND any POs → step 3 will FAIL LOUDLY (caller must seed).
UPDATE "purchase_orders"
   SET "tenant_id" = (SELECT id FROM "tenants" ORDER BY "created_at" ASC LIMIT 1)
 WHERE "tenant_id" IS NULL;

-- 3. Enforce NOT NULL going forward.
ALTER TABLE "purchase_orders" ALTER COLUMN "tenant_id" SET NOT NULL;

-- 4. Foreign key.
ALTER TABLE "purchase_orders"
  ADD CONSTRAINT "purchase_orders_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5. Index for tenant-scoped queries (list, byId, count, scoped admin filters).
CREATE INDEX "purchase_orders_tenant_id_idx" ON "purchase_orders"("tenant_id");
