export type User = {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  roleId: string;
  departmentId: string | null;
  isActive: boolean;
  securityVersion: number;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type RoleName =
  | "platform_owner"
  | "tenant_super_admin"
  | "admin"
  | "accountant"
  | "hr_manager"
  | "project_manager"
  | "sales_staff"
  | "purchasing_staff"
  | "inventory_staff"
  | "staff"
  | "cashier"
  | "support_agent"
  | "customer";

export type Role = {
  id: string;
  name: RoleName;
  displayName: string;
  permissions: string[];
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type Department = {
  id: string;
  name: string;
  description: string | null;
  managerId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type AuditLog = {
  id: string;
  userId: string;
  action: string;
  entity: string;
  entityId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: Date;
};
