-- CreateTable
CREATE TABLE "job_order_service_lines" (
    "id" TEXT NOT NULL,
    "job_order_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "hours" DECIMAL(8,2),
    "rate" DECIMAL(12,2),
    "amount" DECIMAL(12,2) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_order_service_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_order_service_lines_job_order_id_idx" ON "job_order_service_lines"("job_order_id");

-- AddForeignKey
ALTER TABLE "job_order_service_lines" ADD CONSTRAINT "job_order_service_lines_job_order_id_fkey" FOREIGN KEY ("job_order_id") REFERENCES "job_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
