export type InvoiceStatus =
  | "draft"
  | "sent"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "void";

export type Invoice = {
  id: string;
  invoiceNumber: string;
  customerId: string;
  quotationId: string | null;
  subscriptionId: string | null;
  status: InvoiceStatus;
  issueDate: Date;
  dueDate: Date;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  currency: string;
  notes: string | null;
  publicToken: string | null;
  signatureUrl: string | null;
  isPublished: boolean;
  preparedById: string;
  createdAt: Date;
  updatedAt: Date;
};

export type PaymentMethod =
  | "cash"
  | "bank_transfer"
  | "card"
  | "gcash"
  | "maya"
  | "xendit"
  | "check"
  | "other";

export type Payment = {
  id: string;
  invoiceId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  referenceNumber: string | null;
  xenditPaymentId: string | null;
  notes: string | null;
  paidAt: Date;
  receivedById: string;
  createdAt: Date;
  updatedAt: Date;
};

export type SubscriptionStatus = "active" | "paused" | "cancelled" | "expired";
export type SubscriptionFrequency = "monthly" | "quarterly" | "yearly";

export type Subscription = {
  id: string;
  customerId: string;
  name: string;
  description: string | null;
  amount: number;
  currency: string;
  frequency: SubscriptionFrequency;
  status: SubscriptionStatus;
  startDate: Date;
  nextBillingDate: Date;
  endDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
