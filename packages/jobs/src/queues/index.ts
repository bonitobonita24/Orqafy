import { Queue } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { DEFAULT_JOB_OPTIONS } from "../types.js";
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

export const QUEUE_NAMES = {
  TENANT_PROVISIONING: "tenant-provisioning",
  TENANT_BILLING: "tenant-billing",
  INVOICE_PROCESSING: "invoice-processing",
  SUBSCRIPTION_BILLING: "subscription-billing",
  INVENTORY_ALERTS: "inventory-alerts",
  GOODS_RECEIPT: "goods-receipt",
  PAYMENT_PROCESSING: "payment-processing",
  CREDIT_PROCESSING: "credit-processing",
  EXPENSE_PROCESSING: "expense-processing",
  CASH_ADVANCE: "cash-advance",
  CREDIT_CARD_PAYMENT: "credit-card-payment",
  PAYROLL_PROCESSING: "payroll-processing",
  SHIPPING_COST_RECALC: "shipping-cost-recalc",
  MOBILE_SYNC: "mobile-sync",
  PDF_GENERATION: "pdf-generation",
  REPORT_EXPORT: "report-export",
  NOTIFICATIONS: "notifications",
  PAYROLL_REMINDER: "payroll-reminder",
  INVENTORY_DISBURSEMENT: "inventory-disbursement",
  DEMO_RESET: "demo-reset",
  ECOMMERCE_ORDER_PROCESSING: "ecommerce-order-processing",
  XENDIT_WEBHOOK_PROCESSING: "xendit-webhook-processing",
  JOB_ORDER_NOTIFICATIONS: "job-order-notifications",
  NOTIFICATION_EMAIL_DIGEST: "notification-email-digest",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export type OrqafyQueues = {
  tenantProvisioning: Queue<TenantProvisioningJobData>;
  tenantBilling: Queue<TenantBillingJobData>;
  invoiceProcessing: Queue<InvoiceProcessingJobData>;
  subscriptionBilling: Queue<SubscriptionBillingJobData>;
  inventoryAlerts: Queue<InventoryAlertsJobData>;
  goodsReceipt: Queue<GoodsReceiptJobData>;
  paymentProcessing: Queue<PaymentProcessingJobData>;
  creditProcessing: Queue<CreditProcessingJobData>;
  expenseProcessing: Queue<ExpenseProcessingJobData>;
  cashAdvance: Queue<CashAdvanceJobData>;
  creditCardPayment: Queue<CreditCardPaymentJobData>;
  payrollProcessing: Queue<PayrollProcessingJobData>;
  shippingCostRecalc: Queue<ShippingCostRecalcJobData>;
  mobileSync: Queue<MobileSyncJobData>;
  pdfGeneration: Queue<PdfGenerationJobData>;
  reportExport: Queue<ReportExportJobData>;
  notifications: Queue<NotificationsJobData>;
  payrollReminder: Queue<PayrollReminderJobData>;
  inventoryDisbursement: Queue<InventoryDisbursementJobData>;
  demoReset: Queue<DemoResetJobData>;
  ecommerceOrderProcessing: Queue<EcommerceOrderProcessingJobData>;
  xenditWebhookProcessing: Queue<XenditWebhookProcessingJobData>;
  jobOrderNotifications: Queue<JobOrderNotificationsJobData>;
  notificationEmailDigest: Queue<NotificationEmailDigestJobData>;
};

export function createQueues(connection: ConnectionOptions): OrqafyQueues {
  const opts = { connection, defaultJobOptions: DEFAULT_JOB_OPTIONS };

  return {
    tenantProvisioning: new Queue<TenantProvisioningJobData>(QUEUE_NAMES.TENANT_PROVISIONING, opts),
    tenantBilling: new Queue<TenantBillingJobData>(QUEUE_NAMES.TENANT_BILLING, opts),
    invoiceProcessing: new Queue<InvoiceProcessingJobData>(QUEUE_NAMES.INVOICE_PROCESSING, opts),
    subscriptionBilling: new Queue<SubscriptionBillingJobData>(QUEUE_NAMES.SUBSCRIPTION_BILLING, opts),
    inventoryAlerts: new Queue<InventoryAlertsJobData>(QUEUE_NAMES.INVENTORY_ALERTS, opts),
    goodsReceipt: new Queue<GoodsReceiptJobData>(QUEUE_NAMES.GOODS_RECEIPT, opts),
    paymentProcessing: new Queue<PaymentProcessingJobData>(QUEUE_NAMES.PAYMENT_PROCESSING, opts),
    creditProcessing: new Queue<CreditProcessingJobData>(QUEUE_NAMES.CREDIT_PROCESSING, opts),
    expenseProcessing: new Queue<ExpenseProcessingJobData>(QUEUE_NAMES.EXPENSE_PROCESSING, opts),
    cashAdvance: new Queue<CashAdvanceJobData>(QUEUE_NAMES.CASH_ADVANCE, opts),
    creditCardPayment: new Queue<CreditCardPaymentJobData>(QUEUE_NAMES.CREDIT_CARD_PAYMENT, opts),
    payrollProcessing: new Queue<PayrollProcessingJobData>(QUEUE_NAMES.PAYROLL_PROCESSING, opts),
    shippingCostRecalc: new Queue<ShippingCostRecalcJobData>(QUEUE_NAMES.SHIPPING_COST_RECALC, opts),
    mobileSync: new Queue<MobileSyncJobData>(QUEUE_NAMES.MOBILE_SYNC, opts),
    pdfGeneration: new Queue<PdfGenerationJobData>(QUEUE_NAMES.PDF_GENERATION, opts),
    reportExport: new Queue<ReportExportJobData>(QUEUE_NAMES.REPORT_EXPORT, opts),
    notifications: new Queue<NotificationsJobData>(QUEUE_NAMES.NOTIFICATIONS, opts),
    payrollReminder: new Queue<PayrollReminderJobData>(QUEUE_NAMES.PAYROLL_REMINDER, opts),
    inventoryDisbursement: new Queue<InventoryDisbursementJobData>(QUEUE_NAMES.INVENTORY_DISBURSEMENT, opts),
    demoReset: new Queue<DemoResetJobData>(QUEUE_NAMES.DEMO_RESET, opts),
    ecommerceOrderProcessing: new Queue<EcommerceOrderProcessingJobData>(QUEUE_NAMES.ECOMMERCE_ORDER_PROCESSING, opts),
    xenditWebhookProcessing: new Queue<XenditWebhookProcessingJobData>(QUEUE_NAMES.XENDIT_WEBHOOK_PROCESSING, opts),
    jobOrderNotifications: new Queue<JobOrderNotificationsJobData>(QUEUE_NAMES.JOB_ORDER_NOTIFICATIONS, opts),
    notificationEmailDigest: new Queue<NotificationEmailDigestJobData>(QUEUE_NAMES.NOTIFICATION_EMAIL_DIGEST, opts),
  };
}

export { DEFAULT_JOB_OPTIONS };
