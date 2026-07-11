import { describe, expect, it, beforeAll } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import type { FeatureKey } from '@orqafy/shared/rbac';
import { STANDARD_ROLES } from '../roles';
import { backfillRolePermissions } from '../role-permissions';
import { hasPermission } from '../../rbac/has-permission';

/**
 * PARITY HARNESS (Task 3.3): for every gated router found in the 2026-07-11
 * grep of apps/web/src/server/trpc/routers, assert that `hasPermission()`
 * against the backfilled matrix yields the SAME allow/deny as the current
 * name-based `ctx.roles.some(...)` allow-lists — for a representative user
 * of EACH of the 13 STANDARD_ROLES. This proves the backfill is a true
 * day-one no-op: nobody gains or loses access relative to today's routers.
 *
 * In-memory fake Prisma — packages/db has no shared test-mock helper yet
 * (see rbac/__tests__/has-permission.test.ts for the same hand-rolled
 * pattern). Only the two model methods this test path touches are
 * implemented: `role.findFirst` (has-permission.ts) and
 * `rolePermission.upsert` / `rolePermission.findUnique`
 * (role-permissions.ts / has-permission.ts).
 */

const TENANT_ID = 'tenant_parity_1';

function makeFakePrisma(): PrismaClient {
  const roles = new Map<string, { id: string; tenantId: string; name: string }>();
  for (const r of STANDARD_ROLES) {
    const roleId = `role_${r.slug}`;
    roles.set(roleId, { id: roleId, tenantId: TENANT_ID, name: r.name });
  }

  const matrix = new Map<
    string,
    { tenantId: string; roleId: string; featureKey: string; view: boolean; create: boolean; update: boolean; delete: boolean }
  >();
  const key = (tenantId: string, roleId: string, featureKey: string) => `${tenantId}::${roleId}::${featureKey}`;

  return {
    role: {
      findFirst: async ({ where }: { where: { id: string; tenantId: string } }) => {
        const role = roles.get(where.id);
        if (!role || role.tenantId !== where.tenantId) return null;
        return role;
      },
    },
    rolePermission: {
      upsert: async ({
        where,
        update,
        create,
      }: {
        where: { tenantId_roleId_featureKey: { tenantId: string; roleId: string; featureKey: string } };
        update: { view: boolean; create: boolean; update: boolean; delete: boolean };
        create: { tenantId: string; roleId: string; featureKey: string; view: boolean; create: boolean; update: boolean; delete: boolean };
      }) => {
        const k = key(
          where.tenantId_roleId_featureKey.tenantId,
          where.tenantId_roleId_featureKey.roleId,
          where.tenantId_roleId_featureKey.featureKey,
        );
        const existing = matrix.get(k);
        const row = existing ? { ...existing, ...update } : create;
        matrix.set(k, row);
        return row;
      },
      findUnique: async ({
        where,
      }: {
        where: { tenantId_roleId_featureKey: { tenantId: string; roleId: string; featureKey: string } };
      }) => {
        const k = key(
          where.tenantId_roleId_featureKey.tenantId,
          where.tenantId_roleId_featureKey.roleId,
          where.tenantId_roleId_featureKey.featureKey,
        );
        return matrix.get(k) ?? null;
      },
    },
  } as unknown as PrismaClient;
}

const roleIdBySlug: Record<string, string> = Object.fromEntries(
  STANDARD_ROLES.map((r) => [r.slug, `role_${r.slug}`]),
);

let prisma: PrismaClient;

/** Convenience: hasPermission for a role slug + feature + action in TENANT_ID. */
async function can(roleSlug: string, feature: FeatureKey, action: 'view' | 'create' | 'update' | 'delete') {
  const roleId = roleIdBySlug[roleSlug];
  if (roleId === undefined) throw new Error(`unknown role slug: ${roleSlug}`);
  return hasPermission(prisma, { tenantId: TENANT_ID, roleId, feature, action });
}

const ALL_FEATURES: FeatureKey[] = [
  'dashboard', 'crm', 'invoices', 'purchasing', 'inventory', 'projects', 'tasks',
  'employees', 'dtr', 'payroll', 'expenses', 'banking', 'accounting', 'pos',
  'storefront', 'support', 'job_orders', 'reports', 'compliance', 'dsr',
  'settings', 'users', 'billing',
];

const NON_BYPASS_NON_CUSTOMER_SLUGS = STANDARD_ROLES
  .map((r) => r.slug)
  .filter((s) => !['platform_owner', 'tenant_super_admin', 'customer'].includes(s));

beforeAll(async () => {
  prisma = makeFakePrisma();
  await backfillRolePermissions(prisma, { tenantId: TENANT_ID, roleIdBySlug });
});

describe('role-permissions backfill — day-one no-op parity', () => {
  describe('view parity — nav is currently unfiltered', () => {
    it('every internal-staff role sees every feature (view=true) — no nav item was hidden today', async () => {
      for (const slug of NON_BYPASS_NON_CUSTOMER_SLUGS) {
        for (const feature of ALL_FEATURES) {
          expect(await can(slug, feature, 'view'), `${slug} should view ${feature}`).toBe(true);
        }
      }
    });

    it('Platform Owner and Tenant Super Admin see every feature via matrix bypass', async () => {
      for (const feature of ALL_FEATURES) {
        expect(await can('platform_owner', feature, 'view')).toBe(true);
        expect(await can('tenant_super_admin', feature, 'view')).toBe(true);
      }
    });

    it('Customer sees ONLY the storefront (customer-portal surface) — no internal back-office feature', async () => {
      expect(await can('customer', 'storefront', 'view')).toBe(true);
      const backOffice = ALL_FEATURES.filter((f) => f !== 'storefront');
      for (const feature of backOffice) {
        expect(await can('customer', feature, 'view'), `customer should NOT view ${feature}`).toBe(false);
      }
    });
  });

  describe('the 4 confirmed dead-gate cases stay restrictive (2026-07-11 ruling)', () => {
    it('accounting.ts allowed=["Administrator","Accountant"] → only Accountant has CUD (Admin excluded)', async () => {
      expect(await can('accountant', 'accounting', 'create')).toBe(true);
      expect(await can('accountant', 'accounting', 'update')).toBe(true);
      expect(await can('accountant', 'accounting', 'delete')).toBe(true);

      // "Admin" was never in accounting.ts's allow-list even as intent — ground
      // truth says it stays excluded, unlike settings/compliance where Admin IS granted.
      expect(await can('admin', 'accounting', 'create')).toBe(false);
      expect(await can('hr_manager', 'accounting', 'create')).toBe(false);
      expect(await can('sales_staff', 'accounting', 'create')).toBe(false);
    });

    it('dtr.ts APPROVER_ROLES=["HR Manager","Manager","Administrator"] → only HR Manager approves (update)', async () => {
      expect(await can('hr_manager', 'dtr', 'update')).toBe(true);
      expect(await can('admin', 'dtr', 'update')).toBe(false);
      expect(await can('project_manager', 'dtr', 'update')).toBe(false);
      expect(await can('staff', 'dtr', 'update')).toBe(false);
      // Self-service (clock-in / leave-request create) genuinely IS broad
      // today (writeProcedure only, no role check) — preserved, not narrowed.
      expect(await can('staff', 'dtr', 'create')).toBe(true);
    });

    it('employee.ts TERMINATE_ROLES=["HR Manager","Manager","Administrator"] → only HR Manager terminates (delete)', async () => {
      expect(await can('hr_manager', 'employees', 'delete')).toBe(true);
      expect(await can('admin', 'employees', 'delete')).toBe(false);
      expect(await can('project_manager', 'employees', 'delete')).toBe(false);
      // create/update (employee.create/update) are ungated writeProcedure —
      // preserved broad for every internal role.
      expect(await can('staff', 'employees', 'create')).toBe(true);
      expect(await can('staff', 'employees', 'update')).toBe(true);
    });

    it('storefront.ts ADMIN_ROLES=Set(["Administrator","Platform Owner"]) → no non-bypass role manages orders', async () => {
      for (const slug of NON_BYPASS_NON_CUSTOMER_SLUGS) {
        expect(await can(slug, 'storefront', 'update'), `${slug} should NOT manage storefront orders`).toBe(false);
        expect(await can(slug, 'storefront', 'delete')).toBe(false);
      }
      expect(await can('platform_owner', 'storefront', 'update')).toBe(true);
      // placeOrder is a SEPARATE, ungated writeProcedure — every role
      // (including Customer) can create an order today.
      expect(await can('sales_staff', 'storefront', 'create')).toBe(true);
      expect(await can('customer', 'storefront', 'create')).toBe(true);
    });
  });

  describe('settings + compliance — admin-tier CUD (Tenant Super Admin | Admin | Platform Owner)', () => {
    it('settings: only Admin (of the non-bypass roles) may manage department/expense-category/xendit/smtp config', async () => {
      expect(await can('admin', 'settings', 'create')).toBe(true);
      expect(await can('admin', 'settings', 'update')).toBe(true);
      expect(await can('admin', 'settings', 'delete')).toBe(true);
      expect(await can('accountant', 'settings', 'create')).toBe(false);
      expect(await can('hr_manager', 'settings', 'update')).toBe(false);
    });

    it('compliance: only Admin (of the non-bypass roles) may manage breach records', async () => {
      expect(await can('admin', 'compliance', 'create')).toBe(true);
      expect(await can('sales_staff', 'compliance', 'create')).toBe(false);
    });
  });

  describe('purchasing — reactivate gate (already-fixed, real names)', () => {
    it('only Admin + Purchasing Staff may reactivate a vendor (mapped to delete)', async () => {
      expect(await can('admin', 'purchasing', 'delete')).toBe(true);
      expect(await can('purchasing_staff', 'purchasing', 'delete')).toBe(true);
      expect(await can('sales_staff', 'purchasing', 'delete')).toBe(false);
      expect(await can('inventory_staff', 'purchasing', 'delete')).toBe(false);
    });

    it('vendor/PO create+update are ungated — broad for every internal role', async () => {
      expect(await can('cashier', 'purchasing', 'create')).toBe(true);
      expect(await can('support_agent', 'purchasing', 'update')).toBe(true);
    });
  });

  describe('MAJOR FINDING — users feature is currently ungated for ALL internal roles (not just Admin)', () => {
    it('any internal-staff role may list/view AND deactivate any user in the tenant today', async () => {
      for (const slug of NON_BYPASS_NON_CUSTOMER_SLUGS) {
        expect(await can(slug, 'users', 'view'), `${slug} should view users (ground truth: ungated)`).toBe(true);
        expect(await can(slug, 'users', 'update'), `${slug} should deactivate users (ground truth: ungated)`).toBe(true);
      }
      // No invite (create) or hard-delete endpoint exists.
      expect(await can('admin', 'users', 'create')).toBe(false);
      expect(await can('admin', 'users', 'delete')).toBe(false);
    });

    it('Customer is excluded from the users feature entirely (customer-portal accounts never manage tenant users)', async () => {
      expect(await can('customer', 'users', 'view')).toBe(false);
      expect(await can('customer', 'users', 'update')).toBe(false);
    });
  });

  describe('billing — no router/mutation exists anywhere; nothing to grant beyond nav-view', () => {
    it('every internal role has billing view=true (unfiltered nav) but zero CUD capability', async () => {
      for (const slug of NON_BYPASS_NON_CUSTOMER_SLUGS) {
        expect(await can(slug, 'billing', 'create')).toBe(false);
        expect(await can(slug, 'billing', 'update')).toBe(false);
        expect(await can(slug, 'billing', 'delete')).toBe(false);
      }
    });
  });

  describe('fully ungated CRUD features — broad for every internal-staff role', () => {
    it.each([
      ['crm', 'create'], ['crm', 'update'], ['crm', 'delete'],
      ['invoices', 'create'], ['invoices', 'update'],
      ['inventory', 'create'], ['inventory', 'update'],
      ['projects', 'create'], ['projects', 'update'], ['projects', 'delete'],
      ['tasks', 'create'], ['tasks', 'update'], ['tasks', 'delete'],
      ['banking', 'create'], ['banking', 'update'],
      ['pos', 'create'], ['pos', 'update'],
      ['job_orders', 'create'], ['job_orders', 'update'],
      ['expenses', 'create'], ['expenses', 'update'],
      ['payroll', 'create'], ['payroll', 'update'], ['payroll', 'delete'],
      ['support', 'create'], ['support', 'update'],
      ['dsr', 'create'],
    ] as const)('%s.%s is granted to a representative non-privileged role (Staff)', async (feature, action) => {
      expect(await can('staff', feature, action)).toBe(true);
    });
  });

  describe('view-only features — no CUD endpoint exists', () => {
    it.each(['dashboard', 'reports'] as const)('%s has zero CUD for every internal role', async (feature) => {
      for (const slug of NON_BYPASS_NON_CUSTOMER_SLUGS) {
        expect(await can(slug, feature, 'create')).toBe(false);
        expect(await can(slug, feature, 'update')).toBe(false);
        expect(await can(slug, feature, 'delete')).toBe(false);
      }
    });
  });
});
