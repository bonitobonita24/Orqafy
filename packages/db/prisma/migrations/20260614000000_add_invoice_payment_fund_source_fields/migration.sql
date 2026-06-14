-- F2 (Phase 7): invoice partial-payment ledger fields.
-- Links a recorded Payment to the Banking fund source it posted to (D1 auto-post)
-- and to the user who recorded it. Both nullable for backward compatibility with
-- existing payment rows; FKs use ON DELETE SET NULL so ledger history survives
-- fund-source / user deletion.
--
-- NOTE: This migration is scoped STRICTLY to the F2 Payment changes. The
-- migration history in this repo predates a number of tenant_id schema columns
-- (pre-existing drift unrelated to Phase 7); this file deliberately does NOT
-- capture that drift. Generated via `prisma migrate diff` and hand-trimmed.

-- AlterTable
ALTER TABLE "public"."payments" ADD COLUMN     "fund_source_id" TEXT,
ADD COLUMN     "recorded_by_id" TEXT;

-- CreateIndex
CREATE INDEX "payments_fund_source_id_idx" ON "public"."payments"("fund_source_id");

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_fund_source_id_fkey" FOREIGN KEY ("fund_source_id") REFERENCES "public"."fund_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
