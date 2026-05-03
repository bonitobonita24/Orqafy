export type TenantContext = {
  tenantId: string;
  tenantSlug: string;
  schemaName: string;
};

export type PaginationParams = {
  cursor?: string | undefined;
  limit?: number | undefined;
};

export type PaginatedResult<T> = {
  items: T[];
  nextCursor: string | null;
  totalCount: number;
};

export type SortDirection = "asc" | "desc";

export type SortParams<TField extends string = string> = {
  field: TField;
  direction: SortDirection;
};

export type DateRange = {
  from: Date;
  to: Date;
};

export type FileUploadMeta = {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
};

export type AuditAction = "CREATE" | "UPDATE" | "DELETE";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export type Currency = string;
