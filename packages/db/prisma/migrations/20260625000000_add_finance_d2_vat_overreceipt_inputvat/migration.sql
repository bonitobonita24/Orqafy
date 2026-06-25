-- Finance RULES D-2 (DECISIONS_LOG "Finance RULES D-2", 2026-06-25, owner-approved R1/R3/R4).
-- Create-only migration (Phase-7 convention; dev synced via `prisma db push` against direct postgres).
-- New columns land on public.* (the template schema); future tenant schemas inherit them via
-- createTenantSchema's `CREATE TABLE ... (LIKE public.<t> INCLUDING ALL)`. Existing tenant schemas
-- are backfilled by the same `db push`/per-schema sync used for prior finance migrations.

-- R4: default Input VAT (asset) account for PO input-VAT auto-post mapping.
ALTER TABLE "public"."accounting_settings"
  ADD COLUMN "default_input_vat_account_id" TEXT;

-- R1: per-PO VAT-exempt / zero-rated toggle (suppresses the 12% PH VAT line).
ALTER TABLE "public"."purchase_orders"
  ADD COLUMN "is_vat_exempt" BOOLEAN NOT NULL DEFAULT false;

-- R3: audited justification when any received line exceeds the ordered quantity by >10%.
ALTER TABLE "public"."goods_receipts"
  ADD COLUMN "over_receipt_reason" TEXT;
