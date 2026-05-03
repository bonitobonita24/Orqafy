export type ProposalStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";

export type Proposal = {
  id: string;
  proposalNumber: string;
  customerId: string;
  title: string;
  description: string | null;
  status: ProposalStatus;
  validUntil: Date | null;
  totalAmount: number;
  currency: string;
  preparedById: string;
  sentAt: Date | null;
  respondedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ProposalAttachment = {
  id: string;
  proposalId: string;
  name: string;
  fileUrl: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
};

export type ProposalLink = {
  id: string;
  proposalId: string;
  label: string;
  url: string;
  createdAt: Date;
};

export type ProposalRevision = {
  id: string;
  proposalId: string;
  revisionNumber: number;
  changesDescription: string;
  snapshotData: Record<string, unknown>;
  createdById: string;
  createdAt: Date;
};

export type QuotationStatus = "draft" | "sent" | "accepted" | "rejected" | "expired" | "converted";

export type Quotation = {
  id: string;
  quotationNumber: string;
  customerId: string;
  proposalId: string | null;
  title: string;
  status: QuotationStatus;
  validUntil: Date | null;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  notes: string | null;
  preparedById: string;
  sentAt: Date | null;
  respondedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type QuotationSection = {
  id: string;
  quotationId: string;
  name: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

export type QuotationMarkupColumn = {
  id: string;
  quotationId: string;
  name: string;
  percentage: number;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

export type QuotationLineItem = {
  id: string;
  sectionId: string;
  productId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  markedUpPrice: number;
  totalPrice: number;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

export type QuotationLineItemMarkup = {
  id: string;
  lineItemId: string;
  markupColumnId: string;
  percentage: number;
  computedPrice: number;
  createdAt: Date;
};

export type QuotationRevision = {
  id: string;
  quotationId: string;
  revisionNumber: number;
  changesDescription: string;
  snapshotData: Record<string, unknown>;
  createdById: string;
  createdAt: Date;
};
