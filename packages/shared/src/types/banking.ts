export type FundSourceType =
  | "cash_on_hand"
  | "e_wallet"
  | "bank"
  | "credit_card"
  | "loan";

export type LoanStatus = "active" | "paid_off" | "defaulted";

export type FundSource = {
  id: string;
  name: string;
  type: FundSourceType;
  bankName: string | null;
  accountNumber: string | null;
  accountName: string | null;
  currentBalance: number;
  isActive: boolean;
  loanAmount: number | null;
  loanSource: string | null;
  loanStatus: LoanStatus | null;
  creditLimit: number | null;
  statementCycleDay: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type FundTransactionType = "money_in" | "money_out" | "money_out_to";

export type FundTransactionReferenceType =
  | "invoice_payment"
  | "purchase_order_payment"
  | "payroll_release"
  | "cash_advance_release"
  | "project_expense"
  | "pos_sale"
  | "ecommerce_order"
  | "fund_transfer"
  | "fund_request"
  | "credit_card_payment"
  | "loan_payback"
  | "adjustment"
  | "other";

export type FundTransaction = {
  id: string;
  fundSourceId: string;
  type: FundTransactionType;
  amount: number;
  balanceAfter: number;
  referenceType: FundTransactionReferenceType;
  referenceId: string | null;
  description: string;
  transactionDate: Date;
  recordedById: string;
  createdAt: Date;
};

export type FundTransactionAttachment = {
  id: string;
  fundTransactionId: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedById: string;
  uploadedAt: Date;
};

export type FundTransferStatus = "pending" | "approved" | "completed" | "rejected";

export type FundTransfer = {
  id: string;
  fromFundSourceId: string;
  toFundSourceId: string;
  amount: number;
  status: FundTransferStatus;
  description: string | null;
  requestedById: string;
  approvedById: string | null;
  completedAt: Date | null;
  createdAt: Date;
};

export type FundRequestStatus = "pending" | "approved" | "rejected" | "released";

export type FundRequest = {
  id: string;
  requestedById: string;
  fundSourceId: string | null;
  amount: number;
  purpose: string;
  status: FundRequestStatus;
  approvedById: string | null;
  releasedAt: Date | null;
  createdAt: Date;
};

export type CreditCardTransaction = {
  id: string;
  fundSourceId: string;
  amount: number;
  bankFee: number;
  totalBilled: number;
  merchant: string;
  transactionDate: Date;
  referenceType: FundTransactionReferenceType;
  referenceId: string | null;
  description: string | null;
  isPaid: boolean;
  paidAt: Date | null;
  createdAt: Date;
};

export type CreditCardPaymentType = "selective" | "bulk_statement" | "installment";

export type CreditCardPayment = {
  id: string;
  fundSourceId: string;
  payingFundSourceId: string;
  paymentType: CreditCardPaymentType;
  amount: number;
  transactionIds: string[];
  installmentMonths: number | null;
  installmentMonthlyAmount: number | null;
  installmentRemainingMonths: number | null;
  paidAt: Date;
  createdAt: Date;
};
