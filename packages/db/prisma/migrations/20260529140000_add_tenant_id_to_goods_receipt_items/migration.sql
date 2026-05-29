-- Step 1: Add nullable tenant_id column
ALTER TABLE "public"."goods_receipt_items" ADD COLUMN "tenant_id" TEXT;

-- Step 2: Backfill via JOIN from parent goods_receipts (tenant_id NOT NULL since Batch 30)
UPDATE "public"."goods_receipt_items" gri
SET "tenant_id" = gr."tenant_id"
FROM "public"."goods_receipts" gr
WHERE gri."goods_receipt_id" = gr."id";

-- Step 3: Enforce NOT NULL
ALTER TABLE "public"."goods_receipt_items" ALTER COLUMN "tenant_id" SET NOT NULL;

-- Step 4: Add foreign key
ALTER TABLE "public"."goods_receipt_items"
  ADD CONSTRAINT "goods_receipt_items_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 5: Add index
CREATE INDEX "goods_receipt_items_tenant_id_idx" ON "public"."goods_receipt_items"("tenant_id");
