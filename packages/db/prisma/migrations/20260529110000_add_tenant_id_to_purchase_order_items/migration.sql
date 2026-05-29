-- Batch 27 Direction I-2: PurchaseOrderItem.tenantId parity
-- Backfill source: parent purchase_orders.tenant_id (set by Batch 26 migration 20260529100000)
-- Pattern: JOIN-backfill from parent table (Batch 24 EcommerceOrderItem pattern)

-- Step 1: ADD nullable column
ALTER TABLE "purchase_order_items" ADD COLUMN "tenant_id" TEXT;

-- Step 2: BACKFILL via JOIN from parent purchase_orders
UPDATE "purchase_order_items" poi
SET "tenant_id" = po."tenant_id"
FROM "purchase_orders" po
WHERE poi."purchase_order_id" = po."id";

-- Step 3: SET NOT NULL (after backfill — no NULL rows possible since FK requires parent po, and Batch 26 set po.tenantId NOT NULL)
ALTER TABLE "purchase_order_items" ALTER COLUMN "tenant_id" SET NOT NULL;

-- Step 4: ADD foreign key constraint (ON DELETE RESTRICT — prevent orphaning items via tenant delete; ON UPDATE CASCADE — allow tenant id migration)
ALTER TABLE "purchase_order_items"
  ADD CONSTRAINT "purchase_order_items_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 5: ADD index for tenant-scoped query performance
CREATE INDEX "purchase_order_items_tenant_id_idx" ON "purchase_order_items"("tenant_id");
