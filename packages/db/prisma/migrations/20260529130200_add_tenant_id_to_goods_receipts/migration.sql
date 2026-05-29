-- Step 1: Add nullable tenant_id column
ALTER TABLE "public"."goods_receipts" ADD COLUMN "tenant_id" TEXT;

-- Step 2: Backfill via JOIN from parent purchase_orders (tenant_id NOT NULL since Batch 26)
UPDATE "public"."goods_receipts" gr
SET "tenant_id" = po."tenant_id"
FROM "public"."purchase_orders" po
WHERE gr."purchase_order_id" = po."id";

-- Step 3: Enforce NOT NULL
ALTER TABLE "public"."goods_receipts" ALTER COLUMN "tenant_id" SET NOT NULL;

-- Step 4: Add foreign key
ALTER TABLE "public"."goods_receipts"
  ADD CONSTRAINT "goods_receipts_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 5: Add index
CREATE INDEX "goods_receipts_tenant_id_idx" ON "public"."goods_receipts"("tenant_id");
