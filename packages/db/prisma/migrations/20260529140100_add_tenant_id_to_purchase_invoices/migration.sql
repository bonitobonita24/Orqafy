-- Step 1: Add nullable tenant_id column
ALTER TABLE "public"."purchase_invoices" ADD COLUMN "tenant_id" TEXT;

-- Step 2: Backfill via JOIN from parent purchase_orders (tenant_id NOT NULL since Batch 26)
UPDATE "public"."purchase_invoices" pi
SET "tenant_id" = po."tenant_id"
FROM "public"."purchase_orders" po
WHERE pi."purchase_order_id" = po."id";

-- Step 3: Enforce NOT NULL
ALTER TABLE "public"."purchase_invoices" ALTER COLUMN "tenant_id" SET NOT NULL;

-- Step 4: Add foreign key
ALTER TABLE "public"."purchase_invoices"
  ADD CONSTRAINT "purchase_invoices_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 5: Add index
CREATE INDEX "purchase_invoices_tenant_id_idx" ON "public"."purchase_invoices"("tenant_id");
