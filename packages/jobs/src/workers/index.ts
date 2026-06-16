import { Worker } from "bullmq";
import type { ConnectionOptions, Processor } from "bullmq";
import { QUEUE_NAMES } from "../queues/index.js";
import type {
  TenantProvisioningJobData,
  TenantBillingJobData,
  InvoiceProcessingJobData,
  SubscriptionBillingJobData,
  InventoryAlertsJobData,
  GoodsReceiptJobData,
  PaymentProcessingJobData,
  CreditProcessingJobData,
  ExpenseProcessingJobData,
  CashAdvanceJobData,
  CreditCardPaymentJobData,
  PayrollProcessingJobData,
  ShippingCostRecalcJobData,
  MobileSyncJobData,
  PdfGenerationJobData,
  ReportExportJobData,
  NotificationsJobData,
  PayrollReminderJobData,
  InventoryDisbursementJobData,
  DemoResetJobData,
  EcommerceOrderProcessingJobData,
  XenditWebhookProcessingJobData,
  JobOrderNotificationsJobData,
  NotificationEmailDigestJobData,
} from "../types.js";

/** Worker factory — pass in the processor function from the app layer. */

export function createTenantProvisioningWorker(
  processor: Processor<TenantProvisioningJobData>,
  connection: ConnectionOptions,
) {
  return new Worker<TenantProvisioningJobData>(
    QUEUE_NAMES.TENANT_PROVISIONING,
    processor,
    { connection },
  );
}

export function createTenantBillingWorker(
  processor: Processor<TenantBillingJobData>,
  connection: ConnectionOptions,
) {
  return new Worker<TenantBillingJobData>(QUEUE_NAMES.TENANT_BILLING, processor, { connection });
}

export function createInvoiceProcessingWorker(
  processor: Processor<InvoiceProcessingJobData>,
  connection: ConnectionOptions,
) {
  return new Worker<InvoiceProcessingJobData>(QUEUE_NAMES.INVOICE_PROCESSING, processor, { connection });
}

export function createSubscriptionBillingWorker(
  processor: Processor<SubscriptionBillingJobData>,
  connection: ConnectionOptions,
) {
  return new Worker<SubscriptionBillingJobData>(QUEUE_NAMES.SUBSCRIPTION_BILLING, processor, { connection });
}

export function createInventoryAlertsWorker(
  processor: Processor<InventoryAlertsJobData>,
  connection: ConnectionOptions,
) {
  return new Worker<InventoryAlertsJobData>(QUEUE_NAMES.INVENTORY_ALERTS, processor, { connection });
}

export function createGoodsReceiptWorker(
  processor: Processor<GoodsReceiptJobData>,
  connection: ConnectionOptions,
) {
  return new Worker<GoodsReceiptJobData>(QUEUE_NAMES.GOODS_RECEIPT, processor, { connection });
}

export function createPaymentProcessingWorker(
  processor: Processor<PaymentProcessingJobData>,
  connection: ConnectionOptions,
) {
  return new Worker<PaymentProcessingJobData>(QUEUE_NAMES.PAYMENT_PROCESSING, processor, { connection });
}

export function createCreditProcessingWorker(
  processor: Processor<CreditProcessingJobData>,
  connection: ConnectionOptions,
) {
  return new Worker<CreditProcessingJobData>(QUEUE_NAMES.CREDIT_PROCESSING, processor, { connection });
}

export function createExpenseProcessingWorker(
  processor: Processor<ExpenseProcessingJobData>,
  connection: ConnectionOptions,
) {
  return new Worker<ExpenseProcessingJobData>(QUEUE_NAMES.EXPENSE_PROCESSING, processor, { connection });
}

export function createCashAdvanceWorker(
  processor: Processor<CashAdvanceJobData>,
  connection: ConnectionOptions,
) {
  return new Worker<CashAdvanceJobData>(QUEUE_NAMES.CASH_ADVANCE, processor, { connection });
}

export function createCreditCardPaymentWorker(
  processor: Processor<CreditCardPaymentJobData>,
  connection: ConnectionOptions,
) {
  return new Worker<CreditCardPaymentJobData>(QUEUE_NAMES.CREDIT_CARD_PAYMENT, processor, { connection });
}

export function createPayrollProcessingWorker(
  processor: Processor<PayrollProcessingJobData>,
  connection: ConnectionOptions,
) {
  return new Worker<PayrollProcessingJobData>(QUEUE_NAMES.PAYROLL_PROCESSING, processor, { connection });
}

export function createShippingCostRecalcWorker(
  processor: Processor<ShippingCostRecalcJobData>,
  connection: ConnectionOptions,
) {
  return new Worker<ShippingCostRecalcJobData>(QUEUE_NAMES.SHIPPING_COST_RECALC, processor, { connection });
}

export function createMobileSyncWorker(
  processor: Processor<MobileSyncJobData>,
  connection: ConnectionOptions,
) {
  return new Worker<MobileSyncJobData>(QUEUE_NAMES.MOBILE_SYNC, processor, { connection });
}

export function createPdfGenerationWorker(
  processor: Processor<PdfGenerationJobData>,
  connection: ConnectionOptions,
) {
  return new Worker<PdfGenerationJobData>(QUEUE_NAMES.PDF_GENERATION, processor, { connection });
}

export function createReportExportWorker(
  processor: Processor<ReportExportJobData>,
  connection: ConnectionOptions,
) {
  return new Worker<ReportExportJobData>(QUEUE_NAMES.REPORT_EXPORT, processor, { connection });
}

export function createNotificationsWorker(
  processor: Processor<NotificationsJobData>,
  connection: ConnectionOptions,
) {
  return new Worker<NotificationsJobData>(QUEUE_NAMES.NOTIFICATIONS, processor, { connection });
}

export function createPayrollReminderWorker(
  processor: Processor<PayrollReminderJobData>,
  connection: ConnectionOptions,
) {
  return new Worker<PayrollReminderJobData>(QUEUE_NAMES.PAYROLL_REMINDER, processor, { connection });
}

export function createInventoryDisbursementWorker(
  processor: Processor<InventoryDisbursementJobData>,
  connection: ConnectionOptions,
) {
  return new Worker<InventoryDisbursementJobData>(QUEUE_NAMES.INVENTORY_DISBURSEMENT, processor, { connection });
}

export function createDemoResetWorker(
  processor: Processor<DemoResetJobData>,
  connection: ConnectionOptions,
) {
  return new Worker<DemoResetJobData>(QUEUE_NAMES.DEMO_RESET, processor, { connection });
}

export function createEcommerceOrderProcessingWorker(
  processor: Processor<EcommerceOrderProcessingJobData>,
  connection: ConnectionOptions,
) {
  return new Worker<EcommerceOrderProcessingJobData>(QUEUE_NAMES.ECOMMERCE_ORDER_PROCESSING, processor, { connection });
}

export function createXenditWebhookProcessingWorker(
  processor: Processor<XenditWebhookProcessingJobData>,
  connection: ConnectionOptions,
) {
  return new Worker<XenditWebhookProcessingJobData>(QUEUE_NAMES.XENDIT_WEBHOOK_PROCESSING, processor, { connection });
}

export function createJobOrderNotificationsWorker(
  processor: Processor<JobOrderNotificationsJobData>,
  connection: ConnectionOptions,
) {
  return new Worker<JobOrderNotificationsJobData>(QUEUE_NAMES.JOB_ORDER_NOTIFICATIONS, processor, { connection });
}

export function createNotificationEmailDigestWorker(
  processor: Processor<NotificationEmailDigestJobData>,
  connection: ConnectionOptions,
) {
  return new Worker<NotificationEmailDigestJobData>(QUEUE_NAMES.NOTIFICATION_EMAIL_DIGEST, processor, { connection });
}
