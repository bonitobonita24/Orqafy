-- Batch 33 Direction K-prime Phase 1: Invoicing surface tenant parity.
-- 8 models: Customer, CustomerCreditAccount, CustomerCreditTransaction, Invoice, Payment, Subscription, ExpenseCategory, Expense.
-- Direct-tenant backfill for 5 parent models; JOIN-backfill cascade for 3 child models (Payment←Invoice, CCA←Customer, CCT←CCA).
-- Five-stage per table: nullable ADD → backfill → SET NOT NULL → FK → INDEX.

-- ═══════════════════════════════════════════════════════════════
-- STAGE 1 — ADD nullable tenant_id columns on all 8 tables
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE "customers" ADD COLUMN "tenant_id" TEXT;
ALTER TABLE "customer_credit_accounts" ADD COLUMN "tenant_id" TEXT;
ALTER TABLE "customer_credit_transactions" ADD COLUMN "tenant_id" TEXT;
ALTER TABLE "invoices" ADD COLUMN "tenant_id" TEXT;
ALTER TABLE "payments" ADD COLUMN "tenant_id" TEXT;
ALTER TABLE "subscriptions" ADD COLUMN "tenant_id" TEXT;
ALTER TABLE "expense_categories" ADD COLUMN "tenant_id" TEXT;
ALTER TABLE "expenses" ADD COLUMN "tenant_id" TEXT;

-- ═══════════════════════════════════════════════════════════════
-- STAGE 2 — BACKFILL
-- ═══════════════════════════════════════════════════════════════
-- 2a. Direct-tenant parents — assign to oldest tenant (Batches 27-32 canonical pattern).
--     Edge case: zero tenants AND zero rows → no-op, step 3 succeeds vacuously.
--     Edge case: zero tenants AND any rows → step 3 will FAIL LOUDLY (caller must seed).
UPDATE "customers"
   SET "tenant_id" = (SELECT id FROM "tenants" ORDER BY "created_at" ASC LIMIT 1)
 WHERE "tenant_id" IS NULL;

UPDATE "invoices"
   SET "tenant_id" = (SELECT id FROM "tenants" ORDER BY "created_at" ASC LIMIT 1)
 WHERE "tenant_id" IS NULL;

UPDATE "subscriptions"
   SET "tenant_id" = (SELECT id FROM "tenants" ORDER BY "created_at" ASC LIMIT 1)
 WHERE "tenant_id" IS NULL;

UPDATE "expense_categories"
   SET "tenant_id" = (SELECT id FROM "tenants" ORDER BY "created_at" ASC LIMIT 1)
 WHERE "tenant_id" IS NULL;

UPDATE "expenses"
   SET "tenant_id" = (SELECT id FROM "tenants" ORDER BY "created_at" ASC LIMIT 1)
 WHERE "tenant_id" IS NULL;

-- 2b. JOIN-backfill children — inherit tenant_id from their direct parent.
--     Pattern matches Batches 27 (POI←PO), 28 (POIA←POI), 31 (PII←PI).
--     Must run AFTER parent backfill (2a) above.

-- Payment ← Invoice
UPDATE "payments" p
   SET "tenant_id" = i."tenant_id"
  FROM "invoices" i
 WHERE i."id" = p."invoice_id" AND p."tenant_id" IS NULL;

-- CustomerCreditAccount ← Customer
UPDATE "customer_credit_accounts" cca
   SET "tenant_id" = c."tenant_id"
  FROM "customers" c
 WHERE c."id" = cca."customer_id" AND cca."tenant_id" IS NULL;

-- CustomerCreditTransaction ← CustomerCreditAccount (grandchild — cascade depth 2)
UPDATE "customer_credit_transactions" cct
   SET "tenant_id" = cca."tenant_id"
  FROM "customer_credit_accounts" cca
 WHERE cca."id" = cct."credit_account_id" AND cct."tenant_id" IS NULL;

-- ═══════════════════════════════════════════════════════════════
-- STAGE 3 — Enforce NOT NULL on all 8 tables
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE "customers" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "customer_credit_accounts" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "customer_credit_transactions" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "invoices" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "payments" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "subscriptions" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "expense_categories" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "expenses" ALTER COLUMN "tenant_id" SET NOT NULL;

-- ═══════════════════════════════════════════════════════════════
-- STAGE 4 — Foreign keys on all 8 tables
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE "customers"
  ADD CONSTRAINT "customers_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "customer_credit_accounts"
  ADD CONSTRAINT "customer_credit_accounts_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "customer_credit_transactions"
  ADD CONSTRAINT "customer_credit_transactions_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "subscriptions"
  ADD CONSTRAINT "subscriptions_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "expense_categories"
  ADD CONSTRAINT "expense_categories_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "expenses"
  ADD CONSTRAINT "expenses_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════
-- STAGE 5 — Indexes for tenant-scoped queries
-- ═══════════════════════════════════════════════════════════════
CREATE INDEX "customers_tenant_id_idx" ON "customers"("tenant_id");
CREATE INDEX "customer_credit_accounts_tenant_id_idx" ON "customer_credit_accounts"("tenant_id");
CREATE INDEX "customer_credit_transactions_tenant_id_idx" ON "customer_credit_transactions"("tenant_id");
CREATE INDEX "invoices_tenant_id_idx" ON "invoices"("tenant_id");
CREATE INDEX "payments_tenant_id_idx" ON "payments"("tenant_id");
CREATE INDEX "subscriptions_tenant_id_idx" ON "subscriptions"("tenant_id");
CREATE INDEX "expense_categories_tenant_id_idx" ON "expense_categories"("tenant_id");
CREATE INDEX "expenses_tenant_id_idx" ON "expenses"("tenant_id");
