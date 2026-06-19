-- V32.9 Compliance & Data Privacy Layer (RA 10173 / NPC)
-- DataSubjectRequest + BreachRecord tables

-- CreateTable
CREATE TABLE "data_subject_requests" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'received',
    "details" JSONB,
    "resolution" TEXT,
    "handled_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "data_subject_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "breach_records" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "discovered_at" TIMESTAMP(3) NOT NULL,
    "severity" TEXT NOT NULL,
    "affected_subjects" INTEGER,
    "npc_notified_at" TIMESTAMP(3),
    "subjects_notified_at" TIMESTAMP(3),
    "full_report_due_at" TIMESTAMP(3),
    "full_report_filed_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'open',
    "reported_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "breach_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "data_subject_requests_tenant_id_idx" ON "data_subject_requests"("tenant_id");

-- CreateIndex
CREATE INDEX "data_subject_requests_user_id_idx" ON "data_subject_requests"("user_id");

-- CreateIndex
CREATE INDEX "data_subject_requests_tenant_id_status_idx" ON "data_subject_requests"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "breach_records_tenant_id_idx" ON "breach_records"("tenant_id");

-- CreateIndex
CREATE INDEX "breach_records_tenant_id_status_idx" ON "breach_records"("tenant_id", "status");

-- AddForeignKey
ALTER TABLE "data_subject_requests" ADD CONSTRAINT "data_subject_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_subject_requests" ADD CONSTRAINT "data_subject_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "breach_records" ADD CONSTRAINT "breach_records_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
