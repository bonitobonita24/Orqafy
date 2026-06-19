-- Migration: add_tenant_id_to_missing_tables
--
-- Fixes schema drift: 51 tables in the Prisma schema have tenantId fields
-- but the corresponding DB columns were never added in a migration.
-- These were added to the init migration's DDL but the tenant_id column
-- was overlooked when the schema transitioned from single-tenant to multi-tenant.
--
-- 2026-06-19 (first pass): 12 tables formalised below.
-- 2026-06-19 (second pass): a full schema-vs-DB audit found the first pass was
--   INCOMPLETE — 39 MORE tables (incl. warehouse_stocks, pos_sales and their
--   line-item children) also declared tenantId in schema.prisma but lacked the
--   physical column, causing latent P2022 "column does not exist" 500s
--   (storefront.placeOrder, pos.sale.create, and 37 other code paths). The
--   complete set of 39 is appended at the end of this file. Audit method:
--   every model with a `tenantId` field in schema.prisma (94 total) cross-checked
--   against information_schema.columns on staging; the 4 tables without a
--   tenantId field in schema (_prisma_migrations, audit_logs, plans, tenants)
--   are correctly left without the column.
--
-- Applied to staging 2026-06-19 as a direct DB fix; this migration formalises it
-- so prisma migrate deploy on fresh environments is consistent.
--
-- NOTE: All columns are nullable (TEXT, no NOT NULL) to allow rolling deployment.
-- Application code that writes tenant_id must supply it; reads are guarded by
-- the tenant-guard middleware (search_path). Add NOT NULL + FK in a follow-up
-- migration after verifying all write paths supply the value.

-- ─── categories ──────────────────────────────────────────────────────────────
ALTER TABLE public."categories" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
CREATE INDEX IF NOT EXISTS "categories_tenant_id_idx" ON public."categories"("tenant_id");

-- ─── employees ───────────────────────────────────────────────────────────────
ALTER TABLE public."employees" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
CREATE INDEX IF NOT EXISTS "employees_tenant_id_idx" ON public."employees"("tenant_id");

-- ─── fund_sources ─────────────────────────────────────────────────────────────
ALTER TABLE public."fund_sources" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
CREATE INDEX IF NOT EXISTS "fund_sources_tenant_id_idx" ON public."fund_sources"("tenant_id");

-- ─── fund_transactions ────────────────────────────────────────────────────────
ALTER TABLE public."fund_transactions" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
CREATE INDEX IF NOT EXISTS "fund_transactions_tenant_id_idx" ON public."fund_transactions"("tenant_id");

-- ─── job_orders ───────────────────────────────────────────────────────────────
ALTER TABLE public."job_orders" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
CREATE INDEX IF NOT EXISTS "job_orders_tenant_id_idx" ON public."job_orders"("tenant_id");

-- ─── journal_entries ──────────────────────────────────────────────────────────
ALTER TABLE public."journal_entries" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
CREATE INDEX IF NOT EXISTS "journal_entries_tenant_id_idx" ON public."journal_entries"("tenant_id");

-- ─── payrolls ─────────────────────────────────────────────────────────────────
ALTER TABLE public."payrolls" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
CREATE INDEX IF NOT EXISTS "payrolls_tenant_id_idx" ON public."payrolls"("tenant_id");

-- ─── pos_sessions ─────────────────────────────────────────────────────────────
ALTER TABLE public."pos_sessions" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
CREATE INDEX IF NOT EXISTS "pos_sessions_tenant_id_idx" ON public."pos_sessions"("tenant_id");

-- ─── products ─────────────────────────────────────────────────────────────────
ALTER TABLE public."products" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
CREATE INDEX IF NOT EXISTS "products_tenant_id_idx" ON public."products"("tenant_id");

-- ─── projects ─────────────────────────────────────────────────────────────────
ALTER TABLE public."projects" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
CREATE INDEX IF NOT EXISTS "projects_tenant_id_idx" ON public."projects"("tenant_id");

-- ─── support_tickets ──────────────────────────────────────────────────────────
ALTER TABLE public."support_tickets" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
CREATE INDEX IF NOT EXISTS "support_tickets_tenant_id_idx" ON public."support_tickets"("tenant_id");

-- ─── tasks ────────────────────────────────────────────────────────────────────
ALTER TABLE public."tasks" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
CREATE INDEX IF NOT EXISTS "tasks_tenant_id_idx" ON public."tasks"("tenant_id");

-- ─── Fix orphan global unique indexes on roles ────────────────────────────────
-- The init migration created roles_name_key (global unique on name) and
-- roles_slug_key (global unique on slug). Migration 20260602000800 tried to
-- DROP CONSTRAINT them but they are INDEX objects, not constraints, so the
-- DROP was silently ignored. These blocked cross-tenant role provisioning.
DROP INDEX IF EXISTS public."roles_name_key";
DROP INDEX IF EXISTS public."roles_slug_key";

-- ════════════════════════════════════════════════════════════════════════════
-- SECOND PASS (2026-06-19): the 39 tables the first pass missed.
-- All declared `tenantId` in schema.prisma but had no physical tenant_id column.
-- Same nullable-TEXT, no-FK pattern as above. Applied to staging in one txn.
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public."attendance_records" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
CREATE INDEX IF NOT EXISTS "attendance_records_tenant_id_idx" ON public."attendance_records"("tenant_id");
ALTER TABLE public."cash_advance_recoveries" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
CREATE INDEX IF NOT EXISTS "cash_advance_recoveries_tenant_id_idx" ON public."cash_advance_recoveries"("tenant_id");
ALTER TABLE public."cash_advances" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
CREATE INDEX IF NOT EXISTS "cash_advances_tenant_id_idx" ON public."cash_advances"("tenant_id");
ALTER TABLE public."credit_card_payments" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
CREATE INDEX IF NOT EXISTS "credit_card_payments_tenant_id_idx" ON public."credit_card_payments"("tenant_id");
ALTER TABLE public."credit_card_transactions" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
CREATE INDEX IF NOT EXISTS "credit_card_transactions_tenant_id_idx" ON public."credit_card_transactions"("tenant_id");
ALTER TABLE public."customer_contacts" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
CREATE INDEX IF NOT EXISTS "customer_contacts_tenant_id_idx" ON public."customer_contacts"("tenant_id");
ALTER TABLE public."customer_documents" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
CREATE INDEX IF NOT EXISTS "customer_documents_tenant_id_idx" ON public."customer_documents"("tenant_id");
ALTER TABLE public."fund_requests" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
CREATE INDEX IF NOT EXISTS "fund_requests_tenant_id_idx" ON public."fund_requests"("tenant_id");
ALTER TABLE public."fund_transaction_attachments" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
CREATE INDEX IF NOT EXISTS "fund_transaction_attachments_tenant_id_idx" ON public."fund_transaction_attachments"("tenant_id");
ALTER TABLE public."fund_transfers" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
CREATE INDEX IF NOT EXISTS "fund_transfers_tenant_id_idx" ON public."fund_transfers"("tenant_id");
ALTER TABLE public."inventory_disbursement_items" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
CREATE INDEX IF NOT EXISTS "inventory_disbursement_items_tenant_id_idx" ON public."inventory_disbursement_items"("tenant_id");
ALTER TABLE public."inventory_disbursements" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
CREATE INDEX IF NOT EXISTS "inventory_disbursements_tenant_id_idx" ON public."inventory_disbursements"("tenant_id");
ALTER TABLE public."job_order_parts" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
CREATE INDEX IF NOT EXISTS "job_order_parts_tenant_id_idx" ON public."job_order_parts"("tenant_id");
ALTER TABLE public."job_order_service_lines" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
CREATE INDEX IF NOT EXISTS "job_order_service_lines_tenant_id_idx" ON public."job_order_service_lines"("tenant_id");
ALTER TABLE public."journal_lines" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
CREATE INDEX IF NOT EXISTS "journal_lines_tenant_id_idx" ON public."journal_lines"("tenant_id");
ALTER TABLE public."leave_requests" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
CREATE INDEX IF NOT EXISTS "leave_requests_tenant_id_idx" ON public."leave_requests"("tenant_id");
ALTER TABLE public."milestones" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
CREATE INDEX IF NOT EXISTS "milestones_tenant_id_idx" ON public."milestones"("tenant_id");
ALTER TABLE public."payslips" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
CREATE INDEX IF NOT EXISTS "payslips_tenant_id_idx" ON public."payslips"("tenant_id");
ALTER TABLE public."pos_sale_items" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
CREATE INDEX IF NOT EXISTS "pos_sale_items_tenant_id_idx" ON public."pos_sale_items"("tenant_id");
ALTER TABLE public."pos_sales" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
CREATE INDEX IF NOT EXISTS "pos_sales_tenant_id_idx" ON public."pos_sales"("tenant_id");
ALTER TABLE public."product_purchase_history" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
CREATE INDEX IF NOT EXISTS "product_purchase_history_tenant_id_idx" ON public."product_purchase_history"("tenant_id");
ALTER TABLE public."product_serial_numbers" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
CREATE INDEX IF NOT EXISTS "product_serial_numbers_tenant_id_idx" ON public."product_serial_numbers"("tenant_id");
ALTER TABLE public."project_expenses" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
CREATE INDEX IF NOT EXISTS "project_expenses_tenant_id_idx" ON public."project_expenses"("tenant_id");
ALTER TABLE public."project_note_attachments" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
CREATE INDEX IF NOT EXISTS "project_note_attachments_tenant_id_idx" ON public."project_note_attachments"("tenant_id");
ALTER TABLE public."project_notes" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
CREATE INDEX IF NOT EXISTS "project_notes_tenant_id_idx" ON public."project_notes"("tenant_id");
ALTER TABLE public."proposal_attachments" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
CREATE INDEX IF NOT EXISTS "proposal_attachments_tenant_id_idx" ON public."proposal_attachments"("tenant_id");
ALTER TABLE public."proposal_links" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
CREATE INDEX IF NOT EXISTS "proposal_links_tenant_id_idx" ON public."proposal_links"("tenant_id");
ALTER TABLE public."proposal_revisions" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
CREATE INDEX IF NOT EXISTS "proposal_revisions_tenant_id_idx" ON public."proposal_revisions"("tenant_id");
ALTER TABLE public."proposals" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
CREATE INDEX IF NOT EXISTS "proposals_tenant_id_idx" ON public."proposals"("tenant_id");
ALTER TABLE public."stock_movements" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
CREATE INDEX IF NOT EXISTS "stock_movements_tenant_id_idx" ON public."stock_movements"("tenant_id");
ALTER TABLE public."task_assignments" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
CREATE INDEX IF NOT EXISTS "task_assignments_tenant_id_idx" ON public."task_assignments"("tenant_id");
ALTER TABLE public."task_attachments" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
CREATE INDEX IF NOT EXISTS "task_attachments_tenant_id_idx" ON public."task_attachments"("tenant_id");
ALTER TABLE public."task_status_reports" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
CREATE INDEX IF NOT EXISTS "task_status_reports_tenant_id_idx" ON public."task_status_reports"("tenant_id");
ALTER TABLE public."ticket_attachments" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
CREATE INDEX IF NOT EXISTS "ticket_attachments_tenant_id_idx" ON public."ticket_attachments"("tenant_id");
ALTER TABLE public."ticket_comments" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
CREATE INDEX IF NOT EXISTS "ticket_comments_tenant_id_idx" ON public."ticket_comments"("tenant_id");
ALTER TABLE public."time_logs" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
CREATE INDEX IF NOT EXISTS "time_logs_tenant_id_idx" ON public."time_logs"("tenant_id");
ALTER TABLE public."todo_attachments" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
CREATE INDEX IF NOT EXISTS "todo_attachments_tenant_id_idx" ON public."todo_attachments"("tenant_id");
ALTER TABLE public."todos" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
CREATE INDEX IF NOT EXISTS "todos_tenant_id_idx" ON public."todos"("tenant_id");
ALTER TABLE public."warehouse_stocks" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
CREATE INDEX IF NOT EXISTS "warehouse_stocks_tenant_id_idx" ON public."warehouse_stocks"("tenant_id");
