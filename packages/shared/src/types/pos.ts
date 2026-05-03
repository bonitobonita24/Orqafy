export type POSSessionStatus = "open" | "closed";

export type POSSession = {
  id: string;
  openedById: string;
  closedById: string | null;
  fundSourceId: string;
  openingCash: number;
  closingCash: number | null;
  status: POSSessionStatus;
  openedAt: Date;
  closedAt: Date | null;
  notes: string | null;
  createdAt: Date;
};

export type POSSaleStatus = "completed" | "voided" | "refunded";

export type POSSale = {
  id: string;
  sessionId: string;
  customerId: string | null;
  invoiceId: string | null;
  totalAmount: number;
  discountAmount: number;
  taxAmount: number;
  netAmount: number;
  paymentMethod: string;
  status: POSSaleStatus;
  soldById: string;
  createdAt: Date;
};

export type POSSaleItem = {
  id: string;
  saleId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  totalPrice: number;
  serialNumberIds: string[];
  createdAt: Date;
};
