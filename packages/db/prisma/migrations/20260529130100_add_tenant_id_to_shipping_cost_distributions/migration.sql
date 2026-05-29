-- Step 1: Add nullable tenant_id column
ALTER TABLE "public"."shipping_cost_distributions" ADD COLUMN "tenant_id" TEXT;

-- Step 2: Backfill via JOIN from purchase_order_items on item_id (POI.tenant_id NOT NULL since Batch 27)
UPDATE "public"."shipping_cost_distributions" scd
SET "tenant_id" = poi."tenant_id"
FROM "public"."purchase_order_items" poi
WHERE scd."item_id" = poi."id";

-- Step 3: Enforce NOT NULL
ALTER TABLE "public"."shipping_cost_distributions" ALTER COLUMN "tenant_id" SET NOT NULL;

-- Step 4: Add foreign key
ALTER TABLE "public"."shipping_cost_distributions"
  ADD CONSTRAINT "shipping_cost_distributions_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 5: Add index
CREATE INDEX "shipping_cost_distributions_tenant_id_idx" ON "public"."shipping_cost_distributions"("tenant_id");
