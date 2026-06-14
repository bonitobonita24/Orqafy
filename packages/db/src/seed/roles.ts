/**
 * Canonical standard role set for every tenant.
 *
 * SINGLE SOURCE OF TRUTH — consumed by:
 *   - the seed (packages/db/src/seed/index.ts), which seeds these into the demo tenant
 *   - tenant provisioning (packages/db/src/helpers/tenant-owner.ts), which seeds these
 *     into every newly self-registered tenant so the owner can immediately assign roles
 *
 * Do NOT redefine these inline anywhere else. Import STANDARD_ROLES instead.
 */
export interface StandardRoleDef {
  name: string;
  slug: string;
  isSystem: boolean;
  sortOrder: number;
  permissions: readonly string[];
}

export const STANDARD_ROLES: readonly StandardRoleDef[] = [
  { name: 'Platform Owner', slug: 'platform_owner', isSystem: true, sortOrder: 0, permissions: ['*'] },
  { name: 'Tenant Super Admin', slug: 'tenant_super_admin', isSystem: true, sortOrder: 1, permissions: ['tenant.*'] },
  { name: 'Admin', slug: 'admin', isSystem: true, sortOrder: 2, permissions: ['tenant.read', 'tenant.write', 'users.*', 'reports.*', 'settings.*'] },
  { name: 'Accountant', slug: 'accountant', isSystem: false, sortOrder: 3, permissions: ['accounting.*', 'banking.*', 'invoicing.*', 'reports.financial'] },
  { name: 'HR Manager', slug: 'hr_manager', isSystem: false, sortOrder: 4, permissions: ['hr.*', 'payroll.*', 'attendance.*', 'reports.hr'] },
  { name: 'Project Manager', slug: 'project_manager', isSystem: false, sortOrder: 5, permissions: ['projects.*', 'tasks.*', 'reports.project'] },
  { name: 'Sales Staff', slug: 'sales_staff', isSystem: false, sortOrder: 6, permissions: ['crm.*', 'proposals.*', 'quotations.*', 'invoices.read', 'invoices.create'] },
  { name: 'Purchasing Staff', slug: 'purchasing_staff', isSystem: false, sortOrder: 7, permissions: ['purchasing.*', 'vendors.*', 'inventory.read'] },
  { name: 'Inventory Staff', slug: 'inventory_staff', isSystem: false, sortOrder: 8, permissions: ['inventory.*', 'warehouse.*', 'goods_receipt.*'] },
  { name: 'Staff', slug: 'staff', isSystem: false, sortOrder: 9, permissions: ['tasks.read', 'tasks.update_own', 'attendance.own', 'leave.own', 'payslip.own'] },
  { name: 'Cashier', slug: 'cashier', isSystem: false, sortOrder: 10, permissions: ['pos.*', 'payments.create', 'fund_sources.read'] },
  { name: 'Support Agent', slug: 'support_agent', isSystem: false, sortOrder: 11, permissions: ['support.*', 'customers.read'] },
  { name: 'Customer', slug: 'customer', isSystem: true, sortOrder: 12, permissions: ['portal.own'] },
] as const;

/** Slug of the role assigned to a self-registered tenant's owner user. */
export const TENANT_SUPER_ADMIN_SLUG = 'tenant_super_admin';

/** bcrypt cost factor — MUST match the seed (packages/db/src/seed/index.ts). */
export const PASSWORD_BCRYPT_COST = 12;
