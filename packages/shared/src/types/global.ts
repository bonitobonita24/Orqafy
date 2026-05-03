export type Tenant = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  schemaName: string;
  domain: string | null;
  logoUrl: string | null;
  planId: string | null;
  settings: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type Plan = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  maxUsers: number;
  maxStorageMb: number;
  features: string[];
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type TenantSubscription = {
  id: string;
  tenantId: string;
  planId: string;
  status: TenantSubscriptionStatus;
  billingCycle: BillingCycle;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type TenantSubscriptionStatus =
  | "active"
  | "past_due"
  | "cancelled"
  | "trialing";

export type BillingCycle = "monthly" | "yearly";

export type TenantInvoice = {
  id: string;
  tenantId: string;
  subscriptionId: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: TenantInvoiceStatus;
  dueDate: Date;
  paidAt: Date | null;
  xenditInvoiceId: string | null;
  xenditInvoiceUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type TenantInvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "void";

export type TenantPayment = {
  id: string;
  tenantId: string;
  invoiceId: string;
  amount: number;
  currency: string;
  method: string;
  xenditPaymentId: string | null;
  status: TenantPaymentStatus;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type TenantPaymentStatus = "pending" | "completed" | "failed" | "refunded";

export type TenantAuditLog = {
  id: string;
  tenantId: string;
  userId: string | null;
  action: string;
  entity: string;
  entityId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: Date;
};

export type TenantSmtpConfig = {
  id: string;
  tenantId: string;
  host: string;
  port: number;
  username: string;
  fromAddress: string;
  fromName: string;
  useTls: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type TenantXenditConfig = {
  id: string;
  tenantId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};
