export type AccountType = "asset" | "liability" | "equity" | "income" | "expense";

export type Account = {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  parentId: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type JournalEntryStatus = "draft" | "posted" | "void";

export type JournalEntry = {
  id: string;
  entryNumber: string;
  date: Date;
  description: string;
  referenceType: string | null;
  referenceId: string | null;
  status: JournalEntryStatus;
  createdById: string;
  postedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type JournalLine = {
  id: string;
  journalEntryId: string;
  accountId: string;
  debit: number;
  credit: number;
  description: string | null;
  createdAt: Date;
};

export type TaxRate = {
  id: string;
  name: string;
  rate: number;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type FiscalYearStatus = "open" | "closed";

export type FiscalYear = {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: FiscalYearStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type ExpenseCategory = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  accountId: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};
