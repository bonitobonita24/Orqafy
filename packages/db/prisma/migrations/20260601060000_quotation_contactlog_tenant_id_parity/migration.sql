-- Batch 34 Direction K-prime Extended Phase 1: Quotation + ContactLog surface tenant parity.
-- 7 models: Quotation, ContactLog (direct parents — backfill from customers.tenant_id);
--          QuotationSection, QuotationMarkupColumn, QuotationLineItem, QuotationLineItemMarkup,
--          QuotationRevision (children — JOIN-backfill cascade from parent Quotation).
-- Customer.tenant_id is already NOT NULL (Batch 33 K-prime Phase 1, migration 20260531232100).
-- Pattern matches Batches 27 (POI←PO), 28 (POIA←POI), 31 (PII←PI), 33 (Payment←Invoice cascade).

-- ═══════════════════════════════════════════════════════════════
-- STAGE 1 — Add tenant_id (nullable) on all 7 tables
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE "quotations" ADD COLUMN "tenant_id" TEXT;
ALTER TABLE "contact_logs" ADD COLUMN "tenant_id" TEXT;
ALTER TABLE "quotation_sections" ADD COLUMN "tenant_id" TEXT;
ALTER TABLE "quotation_markup_columns" ADD COLUMN "tenant_id" TEXT;
ALTER TABLE "quotation_line_items" ADD COLUMN "tenant_id" TEXT;
ALTER TABLE "quotation_line_item_markups" ADD COLUMN "tenant_id" TEXT;
ALTER TABLE "quotation_revisions" ADD COLUMN "tenant_id" TEXT;

-- ═══════════════════════════════════════════════════════════════
-- STAGE 2 — BACKFILL
-- ═══════════════════════════════════════════════════════════════
-- 2a. Direct parents inherit tenant_id from their parent Customer.
--     Customer.tenant_id is NOT NULL post-Batch 33, so this is total.
UPDATE "quotations" q
   SET "tenant_id" = c."tenant_id"
  FROM "customers" c
 WHERE c."id" = q."customer_id" AND q."tenant_id" IS NULL;

UPDATE "contact_logs" cl
   SET "tenant_id" = c."tenant_id"
  FROM "customers" c
 WHERE c."id" = cl."customer_id" AND cl."tenant_id" IS NULL;

-- 2b. JOIN-backfill children — inherit tenant_id from their direct parent.
--     Pattern matches Batches 27/28/31/33.
--     Must run AFTER parent backfill (2a) above.

-- QuotationSection ← Quotation
UPDATE "quotation_sections" qs
   SET "tenant_id" = q."tenant_id"
  FROM "quotations" q
 WHERE q."id" = qs."quotation_id" AND qs."tenant_id" IS NULL;

-- QuotationMarkupColumn ← Quotation
UPDATE "quotation_markup_columns" qmc
   SET "tenant_id" = q."tenant_id"
  FROM "quotations" q
 WHERE q."id" = qmc."quotation_id" AND qmc."tenant_id" IS NULL;

-- QuotationRevision ← Quotation
UPDATE "quotation_revisions" qr
   SET "tenant_id" = q."tenant_id"
  FROM "quotations" q
 WHERE q."id" = qr."quotation_id" AND qr."tenant_id" IS NULL;

-- QuotationLineItem ← QuotationSection (parent backfilled above)
UPDATE "quotation_line_items" qli
   SET "tenant_id" = qs."tenant_id"
  FROM "quotation_sections" qs
 WHERE qs."id" = qli."section_id" AND qli."tenant_id" IS NULL;

-- QuotationLineItemMarkup ← QuotationLineItem (parent backfilled above)
UPDATE "quotation_line_item_markups" qlim
   SET "tenant_id" = qli."tenant_id"
  FROM "quotation_line_items" qli
 WHERE qli."id" = qlim."line_item_id" AND qlim."tenant_id" IS NULL;

-- ═══════════════════════════════════════════════════════════════
-- STAGE 3 — Enforce NOT NULL on all 7 tables
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE "quotations" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "contact_logs" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "quotation_sections" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "quotation_markup_columns" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "quotation_line_items" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "quotation_line_item_markups" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "quotation_revisions" ALTER COLUMN "tenant_id" SET NOT NULL;

-- ═══════════════════════════════════════════════════════════════
-- STAGE 4 — Foreign keys on all 7 tables
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE "quotations"
  ADD CONSTRAINT "quotations_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "contact_logs"
  ADD CONSTRAINT "contact_logs_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "quotation_sections"
  ADD CONSTRAINT "quotation_sections_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "quotation_markup_columns"
  ADD CONSTRAINT "quotation_markup_columns_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "quotation_line_items"
  ADD CONSTRAINT "quotation_line_items_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "quotation_line_item_markups"
  ADD CONSTRAINT "quotation_line_item_markups_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "quotation_revisions"
  ADD CONSTRAINT "quotation_revisions_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════
-- STAGE 5 — Indexes on tenant_id for query performance
-- ═══════════════════════════════════════════════════════════════
CREATE INDEX "quotations_tenant_id_idx" ON "quotations"("tenant_id");
CREATE INDEX "contact_logs_tenant_id_idx" ON "contact_logs"("tenant_id");
CREATE INDEX "quotation_sections_tenant_id_idx" ON "quotation_sections"("tenant_id");
CREATE INDEX "quotation_markup_columns_tenant_id_idx" ON "quotation_markup_columns"("tenant_id");
CREATE INDEX "quotation_line_items_tenant_id_idx" ON "quotation_line_items"("tenant_id");
CREATE INDEX "quotation_line_item_markups_tenant_id_idx" ON "quotation_line_item_markups"("tenant_id");
CREATE INDEX "quotation_revisions_tenant_id_idx" ON "quotation_revisions"("tenant_id");
