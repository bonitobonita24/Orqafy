-- Batch 28 Direction I-3: PurchaseOrderItemAllocation.tenantId parity
-- Backfill source: parent purchase_order_items.tenant_id (set by Batch 27 migration 20260529110000)
-- Pattern: JOIN-backfill from parent table (Batch 27 PurchaseOrderItem pattern reapplied to grandchild)

-- Step 1: ADD nullable column
ALTER TABLE "purchase_order_item_allocations" ADD COLUMN "tenant_id" TEXT;

-- Step 2: BACKFILL via JOIN from parent purchase_order_items
UPDATE "purchase_order_item_allocations" poia
SET "tenant_id" = poi."tenant_id"
FROM "purchase_order_items" poi
WHERE poia."item_id" = poi."id";

-- Step 3: SET NOT NULL (after backfill — no NULL rows possible since FK requires parent poi, and Batch 27 set poi.tenantId NOT NULL)
ALTER TABLE "purchase_order_item_allocations" ALTER COLUMN "tenant_id" SET NOT NULL;

-- Step 4: ADD foreign key constraint (ON DELETE RESTRICT — prevent orphaning allocations via tenant delete; ON UPDATE CASCADE — allow tenant id migration)
ALTER TABLE "purchase_order_item_allocations"
  ADD CONSTRAINT "purchase_order_item_allocations_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 5: ADD index for tenant-scoped query performance
CREATE INDEX "purchase_order_item_allocations_tenant_id_idx" ON "purchase_order_item_allocations"("tenant_id");
