export type CustomerTier = "regular" | "vip" | "authorized_dealer";

export type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  zipCode: string | null;
  tier: CustomerTier;
  tinNumber: string | null;
  creditLimit: number;
  currentBalance: number;
  notes: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type CustomerContact = {
  id: string;
  customerId: string;
  name: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type CustomerCreditAccount = {
  id: string;
  customerId: string;
  creditLimit: number;
  currentBalance: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type CreditTransactionType = "charge" | "payment" | "adjustment";

export type CustomerCreditTransaction = {
  id: string;
  creditAccountId: string;
  type: CreditTransactionType;
  amount: number;
  referenceType: string | null;
  referenceId: string | null;
  notes: string | null;
  createdAt: Date;
};

export type CustomerDocument = {
  id: string;
  customerId: string;
  name: string;
  fileUrl: string;
  mimeType: string;
  sizeBytes: number;
  uploadedById: string;
  createdAt: Date;
};
