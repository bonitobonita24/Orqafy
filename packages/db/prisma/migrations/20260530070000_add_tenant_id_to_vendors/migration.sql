-- Batch 32 Direction I: Vendor.tenantId parity. Closes the 9th of 9 purchasing models flagged in Batch 26 pre-flight.
-- Five-stage: nullable ADD → backfill from tenants → SET NOT NULL → FK → INDEX.

-- 1. Add nullable column so existing rows survive the ADD.
ALTER TABLE "vendors" ADD COLUMN "tenant_id" TEXT;

-- 2. Backfill existing rows to the oldest tenant. Deterministic and idempotent.
--    Edge case: zero tenants AND zero vendors → no-op, step 3 succeeds vacuously.
--    Edge case: zero tenants AND any vendors → step 3 will FAIL LOUDLY (caller must seed).
UPDATE "vendors"
   SET "tenant_id" = (SELECT id FROM "tenants" ORDER BY "created_at" ASC LIMIT 1)
 WHERE "tenant_id" IS NULL;

-- 3. Enforce NOT NULL going forward.
ALTER TABLE "vendors" ALTER COLUMN "tenant_id" SET NOT NULL;

-- 4. Foreign key.
ALTER TABLE "vendors"
  ADD CONSTRAINT "vendors_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5. Index for tenant-scoped queries (list, byId, count, scoped admin filters).
CREATE INDEX "vendors_tenant_id_idx" ON "vendors"("tenant_id");
