import type { JobsOptions } from "bullmq";

/** Every job payload carries tenant context for worker-side scoping. */
export interface BaseJobData {
  tenantId: string;
  userId: string;
  traceId?: string;
}

/** Default retry configuration — 3 attempts, exponential backoff from 5 s. */
export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 5000,
  },
  removeOnComplete: { count: 100 },
  removeOnFail: false, // keep failures for DLQ inspection
};

// ── Per-queue job data interfaces ──────────────────────────────────────────

export interface TenantProvisioningJobData extends BaseJobData {
  tenantSlug: string;
  tenantName: string;
  schemaName: string;
  plan: string;
  ownerEmail: string;
  ownerName: string;
  ownerPassword: string;
}

export interface TenantBillingJobData extends BaseJobData {
  subscriptionId: string;
  billingPeriod: string;
}

export interface InvoiceProcessingJobData extends BaseJobData {
  invoiceId: string;
  action: "generate" | "send" | "cancel";
}

export interface SubscriptionBillingJobData extends BaseJobData {
  subscriptionId: string;
  dueDate: string;
}

export interface InventoryAlertsJobData extends BaseJobData {
  productId: string;
  warehouseId: string;
  currentQty: number;
  threshold: number;
}

export interface GoodsReceiptJobData extends BaseJobData {
  purchaseOrderId: string;
  warehouseId: string;
  items: Array<{ productId: string; quantity: number }>;
}

export interface PaymentProcessingJobData extends BaseJobData {
  paymentId: string;
  amount: number;
  currency: string;
  method: string;
}

export interface CreditProcessingJobData extends BaseJobData {
  creditMemoId: string;
  amount: number;
}

export interface ExpenseProcessingJobData extends BaseJobData {
  expenseId: string;
  action: "approve" | "reject" | "reimburse";
}

export interface CashAdvanceJobData extends BaseJobData {
  advanceId: string;
  action: "approve" | "settle";
}

export interface CreditCardPaymentJobData extends BaseJobData {
  paymentId: string;
  cardId: string;
  amount: number;
}

export interface PayrollProcessingJobData extends BaseJobData {
  payrollRunId: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  employeeIds?: string[];
}

export interface ShippingCostRecalcJobData extends BaseJobData {
  shipmentId: string;
  reason: string;
}

export interface MobileSyncJobData extends BaseJobData {
  deviceId: string;
  syncType: "full" | "delta";
  lastSyncAt?: string;
}

export interface PdfGenerationJobData extends BaseJobData {
  documentType: string;
  documentId: string;
  templateId?: string;
  outputPath: string;
}

export interface ReportExportJobData extends BaseJobData {
  reportId: string;
  format: "xlsx" | "csv" | "pdf";
  filters: Record<string, unknown>;
  notifyEmail?: string;
}

export interface NotificationsJobData extends BaseJobData {
  recipientIds: string[];
  channel: "email" | "push" | "in-app" | "sms";
  templateId: string;
  payload: Record<string, unknown>;
}

export interface PayrollReminderJobData extends BaseJobData {
  payrollRunId: string;
  reminderType: "approaching" | "overdue";
}

export interface InventoryDisbursementJobData extends BaseJobData {
  disbursementId: string;
  warehouseId: string;
  items: Array<{ productId: string; quantity: number }>;
}

export interface DemoResetJobData extends BaseJobData {
  resetScope: "full" | "data-only";
}

export interface EcommerceOrderProcessingJobData extends BaseJobData {
  orderId: string;
  action: "confirm" | "fulfill" | "cancel" | "refund";
}

export interface XenditWebhookProcessingJobData extends BaseJobData {
  eventType: string;
  externalId: string;
  rawPayload: Record<string, unknown>;
  receivedAt: string;
}

export interface JobOrderNotificationsJobData extends BaseJobData {
  jobOrderId: string;
  event: "created" | "assigned" | "started" | "completed" | "cancelled";
  recipientIds: string[];
}

/**
 * D8 — Email digest job.
 * Triggered on a repeatable BullMQ schedule (default: daily at 07:00 tenant
 * timezone or UTC fallback). The processor finds all unsent notifications for
 * a given user within the tenant, sends a batched email via the tenant's SMTP
 * config, then stamps `email_digest_sent_at` on the included rows.
 *
 * `userId` / `tenantId` from `BaseJobData` identify the single recipient.
 * `recipientEmail` + `recipientName` are carried so the processor does not
 * need a User lookup (cheaper per-job).
 */
export interface NotificationEmailDigestJobData extends BaseJobData {
  recipientEmail: string;
  recipientName: string;
  /** ISO-8601 cutoff: only include notifications created BEFORE this moment. */
  cutoffAt: string;
}
