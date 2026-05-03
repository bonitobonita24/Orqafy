import { z } from "zod";

export const fundSourceTypeSchema = z.enum([
  "cash_on_hand",
  "e_wallet",
  "bank",
  "credit_card",
  "loan",
]);

export const loanStatusSchema = z.enum(["active", "paid_off", "defaulted"]);

export const fundSourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: fundSourceTypeSchema,
  bankName: z.string().nullable(),
  accountNumber: z.string().nullable(),
  accountName: z.string().nullable(),
  currentBalance: z.number(),
  isActive: z.boolean(),
  loanAmount: z.number().nullable(),
  loanSource: z.string().nullable(),
  loanStatus: loanStatusSchema.nullable(),
  creditLimit: z.number().nullable(),
  statementCycleDay: z.number().int().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const fundTransactionTypeSchema = z.enum([
  "money_in",
  "money_out",
  "money_out_to",
]);

export const fundTransactionReferenceTypeSchema = z.enum([
  "invoice_payment",
  "purchase_order_payment",
  "payroll_release",
  "cash_advance_release",
  "project_expense",
  "pos_sale",
  "ecommerce_order",
  "fund_transfer",
  "fund_request",
  "credit_card_payment",
  "loan_payback",
  "adjustment",
  "other",
]);

export const fundTransactionSchema = z.object({
  id: z.string(),
  fundSourceId: z.string(),
  type: fundTransactionTypeSchema,
  amount: z.number(),
  balanceAfter: z.number(),
  referenceType: fundTransactionReferenceTypeSchema,
  referenceId: z.string().nullable(),
  description: z.string(),
  transactionDate: z.coerce.date(),
  recordedById: z.string(),
  createdAt: z.coerce.date(),
});

export const fundTransactionAttachmentSchema = z.object({
  id: z.string(),
  fundTransactionId: z.string(),
  fileUrl: z.string(),
  fileName: z.string(),
  fileSize: z.number().int().nonnegative(),
  mimeType: z.string(),
  uploadedById: z.string(),
  uploadedAt: z.coerce.date(),
});

export const fundTransferStatusSchema = z.enum([
  "pending",
  "approved",
  "completed",
  "rejected",
]);

export const fundTransferSchema = z.object({
  id: z.string(),
  fromFundSourceId: z.string(),
  toFundSourceId: z.string(),
  amount: z.number(),
  status: fundTransferStatusSchema,
  description: z.string().nullable(),
  requestedById: z.string(),
  approvedById: z.string().nullable(),
  completedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
});

export const fundRequestStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
  "released",
]);

export const fundRequestSchema = z.object({
  id: z.string(),
  requestedById: z.string(),
  fundSourceId: z.string().nullable(),
  amount: z.number(),
  purpose: z.string(),
  status: fundRequestStatusSchema,
  approvedById: z.string().nullable(),
  releasedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
});

export const creditCardTransactionSchema = z.object({
  id: z.string(),
  fundSourceId: z.string(),
  amount: z.number(),
  bankFee: z.number(),
  totalBilled: z.number(),
  merchant: z.string(),
  transactionDate: z.coerce.date(),
  referenceType: fundTransactionReferenceTypeSchema,
  referenceId: z.string().nullable(),
  description: z.string().nullable(),
  isPaid: z.boolean(),
  paidAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
});

export const creditCardPaymentTypeSchema = z.enum([
  "selective",
  "bulk_statement",
  "installment",
]);

export const creditCardPaymentSchema = z.object({
  id: z.string(),
  fundSourceId: z.string(),
  payingFundSourceId: z.string(),
  paymentType: creditCardPaymentTypeSchema,
  amount: z.number(),
  transactionIds: z.array(z.string()),
  installmentMonths: z.number().int().nullable(),
  installmentMonthlyAmount: z.number().nullable(),
  installmentRemainingMonths: z.number().int().nullable(),
  paidAt: z.coerce.date(),
  createdAt: z.coerce.date(),
});
