-- Batch 24 (Direction G): EcommerceOrderItem.tenantId parity with parent EcommerceOrder.
-- Defense-in-depth — closes the last per-tenant gap on the ecommerce surface so any
-- future direct item-level admin query has its own tenant boundary instead of relying
-- solely on parent-order JOIN scoping.
-- Three-stage backfill: nullable ADD → UPDATE FROM parent → SET NOT NULL → FK → INDEX.

-- 1. Add nullable column so existing rows survive the ADD.
ALTER TABLE "ecommerce_order_items" ADD COLUMN "tenant_id" TEXT;

-- 2. Backfill from parent ecommerce_orders. Items always have a parent (orderId FK)
--    and parent already has NOT NULL tenant_id since Batch 21c. So every row resolves.
--    Edge case: zero items → no-op, step 3 succeeds vacuously.
--    Edge case: orphan items (no matching parent) → step 3 will FAIL LOUDLY.
UPDATE "ecommerce_order_items" oi
   SET "tenant_id" = o."tenant_id"
  FROM "ecommerce_orders" o
 WHERE oi."order_id" = o."id"
   AND oi."tenant_id" IS NULL;

-- 3. Enforce NOT NULL going forward.
ALTER TABLE "ecommerce_order_items" ALTER COLUMN "tenant_id" SET NOT NULL;

-- 4. Foreign key.
ALTER TABLE "ecommerce_order_items"
  ADD CONSTRAINT "ecommerce_order_items_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5. Index for tenant-scoped queries (defense-in-depth for any future item-level admin filter).
CREATE INDEX "ecommerce_order_items_tenant_id_idx" ON "ecommerce_order_items"("tenant_id");
