import type { PrismaClient } from '@prisma/client';
import { FEATURE_KEYS, type FeatureKey } from '@orqafy/shared/rbac';

/**
 * Day-one `role_permissions` matrix backfill (Task 3.3, tenant-rbac-standard.md §4).
 *
 * GOAL: reproduce the CURRENT name-based role gates scattered across the tRPC
 * routers as data-driven matrix rows — a NO-OP for behavior. This file does NOT
 * change any router. It only seeds rows so a FUTURE task can rewire routers to
 * consult `hasPermission()` (packages/db/src/rbac/has-permission.ts) instead of
 * their inline `ctx.roles.some(...)` checks, without changing who can do what.
 *
 * Ground-truthed 2026-07-11 by grepping every router under
 * apps/web/src/server/trpc/routers for `requireRole` / `ctx.roles` /
 * `ADMIN_ROLES` / `new Set([...])` / `platformProcedure`. See the per-feature
 * comments below for the exact source of each grant. Where a router gate
 * references a DEAD role name (a string that does not match any
 * `STANDARD_ROLES` name — e.g. "Administrator", "Manager", "Purchasing
 * Manager", lowercase "admin") that action currently 403s for EVERY real
 * role — those are preserved as-is (narrow/false), never silently widened.
 *
 * `Platform Owner` and `Tenant Super Admin` bypass the matrix entirely at
 * runtime (has-permission.ts `MATRIX_BYPASS_ROLE_NAMES`) — their rows are
 * seeded full-true here ONLY so the role-builder UI displays a consistent
 * "everything checked" ceiling for them; it has no runtime effect.
 */

type CUD = { view: boolean; create: boolean; update: boolean; delete: boolean };

const FULL: CUD = { view: true, create: true, update: true, delete: true };
const NONE: CUD = { view: false, create: false, update: false, delete: false };

const BYPASS_ROLE_SLUGS: ReadonlySet<string> = new Set([
  'platform_owner',
  'tenant_super_admin',
]);

/**
 * Per-feature default grant for the 10 non-bypass INTERNAL-staff roles
 * (everything except Customer, handled separately below) + optional
 * per-role-slug overrides that replace individual CUD fields for a specific
 * role where the router narrows access further.
 *
 * `view` is uniformly `true` for internal staff on every feature: nav is
 * currently UNFILTERED (sidebar-nav.tsx has no role-based item filtering),
 * so every internal role effectively "sees" every feature today — that is
 * the behavior this backfill preserves. `create`/`update`/`delete` are
 * grant-exactly-what-currently-passes per the grep below.
 */
const FEATURE_DEFAULTS: Record<
  FeatureKey,
  { internalStaff: CUD; roleOverrides?: Record<string, Partial<CUD>> }
> = {
  // View-only surfaces — no CUD endpoints exist for these on any router.
  dashboard: { internalStaff: { view: true, create: false, update: false, delete: false } },
  reports: { internalStaff: { view: true, create: false, update: false, delete: false } },

  // Fully ungated CRUD (protectedProcedure/writeProcedure only, zero role
  // check) — grep confirmed no `ctx.roles`/`requireRole` anywhere in these
  // routers beyond the base tenant/demo-tenant checks.
  crm: { internalStaff: { view: true, create: true, update: true, delete: true } }, // crm.ts: contactDelete exists, ungated
  invoices: { internalStaff: { view: true, create: true, update: true, delete: false } }, // invoice.ts: void is the closest to delete, no hard-delete endpoint
  inventory: { internalStaff: { view: true, create: true, update: true, delete: false } }, // inventory.ts: only toggleActive, no delete endpoint
  projects: { internalStaff: { view: true, create: true, update: true, delete: true } }, // project.ts: milestone delete exists, ungated
  tasks: { internalStaff: { view: true, create: true, update: true, delete: true } }, // tasks.ts: taskDelete + todoDelete exist, ungated
  banking: { internalStaff: { view: true, create: true, update: true, delete: false } }, // banking.ts: only toggleActive, no delete endpoint
  pos: { internalStaff: { view: true, create: true, update: true, delete: false } }, // pos.ts: void is the closest to delete
  job_orders: { internalStaff: { view: true, create: true, update: true, delete: false } }, // job-order.ts: no delete endpoint
  expenses: { internalStaff: { view: true, create: true, update: true, delete: false } }, // expense.ts: approve/reject are ungated, no delete endpoint
  // TIGHTENED per owner ruling 2026-07-11: payroll writes are HR Manager
  // (+ Platform Owner / Tenant Super Admin bypass) only. payroll.ts is now
  // matrix-migrated (matrixMiddleware("payroll", create/update/delete)), so
  // this is a pure seed-grant change — no router edit. `view` stays broad
  // (nav-visibility, unfiltered today), mirroring the `dtr`/`employees`
  // override pattern already used above.
  payroll: {
    internalStaff: { view: true, create: false, update: false, delete: false },
    roleOverrides: { hr_manager: { create: true, update: true, delete: true } },
  },

  // NARROW — admin-tier only (Tenant Super Admin | Admin | Platform Owner),
  // via `requireRole`/inline `ADMIN_ROLES` checks that use the REAL "Admin"
  // name (department.ts, expense-category.ts, admin-xendit-config.ts,
  // smtp-config.ts — all four routers the FEATURE_KEYS 'settings' comment
  // names). `list`/`get` on department + expense-category are broad
  // (protectedProcedure) but smtp-config.get / admin-xendit-config.get are
  // ALSO admin-gated — an existing intra-feature view asymmetry the coarse
  // per-feature `view` boolean cannot express; per Task 3.3 instruction,
  // `view` tracks nav-visibility (unfiltered today), not per-endpoint gating.
  settings: {
    internalStaff: { view: true, create: false, update: false, delete: false },
    roleOverrides: { admin: { create: true, update: true, delete: true } },
  },

  // NARROW — admin-tier only, identical ADMIN_ROLES list to settings, but
  // compliance.ts gates `list`/`byId` (view) admin-only too (breach records
  // are RA 10173 sensitive). Preserved as broad nav-view per the same
  // Task 3.3 view-is-nav-visibility rule; CUD narrowed to Admin.
  compliance: {
    internalStaff: { view: true, create: false, update: false, delete: false },
    roleOverrides: { admin: { create: true, update: true, delete: true } },
  },

  // AMBIGUOUS DEAD-GATE #1 (confirmed ruling): accounting.ts
  // `accountantWriteProcedure` checks `["Administrator", "Accountant"]` —
  // "Administrator" matches no seeded role name; only "Accountant" passes.
  // NOTE: unlike settings/compliance/dsr, the real "Admin" role name was
  // NEVER in this list even as intent — Admin has NO accounting access
  // today. Preserved exactly; do not add Admin. TODO(D-RBAC-DEADGATE).
  accounting: {
    internalStaff: { view: true, create: false, update: false, delete: false },
    roleOverrides: { accountant: { create: true, update: true, delete: true } },
  },

  // AMBIGUOUS DEAD-GATE #2 (confirmed ruling): dtr.ts `requireApproverRole`
  // checks `APPROVER_ROLES = ["HR Manager", "Manager", "Administrator"]` —
  // only "HR Manager" matches a seeded name. This gate covers ONLY the
  // approve/reject actions (attendanceApprove/Reject, leaveRequestApprove/
  // Reject) — mapped to the `update` verb below. `create` (leaveRequestCreate,
  // attendanceClockIn/ClockOut — self-service, ungated) stays broad; narrowing
  // it to HR-Manager-only would break real self-service clock-in/leave-request
  // workflows for every other role, which is NOT how the router behaves today.
  // leaveRequestCancel is also ungated self-service (own-record), folded into
  // `create` for matrix purposes since there's no distinct verb for it.
  // TODO(D-RBAC-DEADGATE): report this create/update split to the architect —
  // the ruling text said "dtr CUD to HR Manager only"; ground truth shows
  // self-service create is broader than that. Narrowed `update` only, per
  // ground truth, to avoid a false-narrow parity assertion.
  dtr: {
    internalStaff: { view: true, create: true, update: false, delete: false },
    roleOverrides: { hr_manager: { update: true } },
  },

  // AMBIGUOUS DEAD-GATE #3 (confirmed ruling): employee.ts
  // `requireTerminateAuthority` checks `TERMINATE_ROLES = ["HR Manager",
  // "Manager", "Administrator"]` — only "HR Manager" matches. This gate is
  // scoped to ONLY the `terminate` action (mapped to `delete`); create/update
  // (employee.create/update) are plain `writeProcedure`, ungated — stay broad.
  employees: {
    internalStaff: { view: true, create: true, update: true, delete: false },
    roleOverrides: { hr_manager: { delete: true } },
  },

  // purchasing.ts: vendor/PO create+update are ungated (writeProcedure only).
  // `reactivate` (ALREADY FIXED, real names per 2026-06-19 DECISIONS_LOG) is
  // gated to `["Tenant Super Admin", "Admin", "Platform Owner", "Purchasing
  // Staff"]` — the closest lifecycle-restricted analog to `delete`, so
  // Admin + Purchasing Staff get delete=true. `approve` (PO approval) checks
  // `["Administrator", "Purchasing Manager", "admin"]` — a 5TH DEAD-GATE not
  // named in the original ruling: NONE of those three strings match ANY real
  // role, so PO approval is currently 403 for EVERYONE including Tenant Super
  // Admin/Platform Owner (this bypass-role-immune bug is a plain
  // `ctx.roles.some(...)` string check, not the new hasPermission() matrix
  // bypass). TODO(D-RBAC-DEADGATE-5, purchasing.approve): report to architect
  // — out of scope to fix here; not represented as a distinct matrix verb
  // since it has no real current holder to preserve.
  purchasing: {
    internalStaff: { view: true, create: true, update: true, delete: false },
    roleOverrides: {
      admin: { delete: true },
      purchasing_staff: { delete: true },
    },
  },

  // AMBIGUOUS DEAD-GATE #4 (confirmed ruling): storefront.ts `requireAdmin`
  // checks `new Set(["Administrator", "Platform Owner"])` — the real "Admin"
  // name was never included (same class of gap as accounting.ts); only
  // "Platform Owner" (matrix bypass) passes. Gates `listAllOrders` (view-all),
  // `createXenditInvoice`, `updateFulfillment`, `updateOrderStatus` — mapped
  // to update/delete = false for every non-bypass role, per the ruling.
  // `placeOrder` is a SEPARATE, ungated `writeProcedure` (any authenticated
  // role — staff placing an order on a customer's behalf, or a Customer
  // account — can create an order) — preserved broad on `create`, since
  // narrowing it to false would misrepresent a real, ungated capability.
  storefront: {
    internalStaff: { view: true, create: true, update: false, delete: false },
  },

  // support.ts: ticket create/changeStatus/close are ungated `writeProcedure`
  // (mapped broad to create+update). `update` (edit fields) additionally
  // allows the ticket's own creator regardless of role (an ownership check,
  // not expressible per-role) — that carve-out is unaffected by this matrix.
  // `assign` checks `ctx.roles.includes("Administrator") ||
  // ctx.roles.includes("Manager")` — BOTH dead names, so assign is currently
  // unreachable by role for EVERY real role (a 6th similar dead-gate, not in
  // the original 4). TODO(D-RBAC-DEADGATE-6, support.assign): report to
  // architect; not represented as a distinct verb (no real current holder).
  support: { internalStaff: { view: true, create: true, update: true, delete: false } },

  // dsr.ts: self-service rights requests (rectify/requestErasure/object) are
  // ungated `writeProcedure` — any authenticated user may file a request
  // about their OWN data. `adminList` (view all tenant requests) is
  // admin-gated (requireRole) but per the Task 3.3 view-is-nav-visibility
  // rule, `view` stays broad. No update/delete endpoints exist.
  dsr: { internalStaff: { view: true, create: true, update: false, delete: false } },

  // MAJOR FINDING — user.ts has ZERO role-based gate of any kind: `list`,
  // `byId` (view) and `deactivate` (mapped to `update`) are plain
  // `protectedProcedure`/`writeProcedure` — ANY authenticated tenant member,
  // not just Admin, can currently list/view/deactivate any other user in
  // the tenant. (`transferOwnership` is gated separately by
  // `caller.isTenantOwner`, an ownership check outside the role matrix —
  // untouched here.) This directly conflicts with the fleet
  // tenant-rbac-standard (Users/Billing reserved for Tenant Super Admin +
  // Platform Owner) and with `assertNoForbiddenFeatures` in
  // packages/db/src/rbac/guardrails.ts, which will reject saving ANY
  // truthy users/billing grant on a non-system role via the role-builder.
  // RESOLVED 2026-07-12 (owner-approved): user.ts (list/byId/deactivate) is now
  // gated to Tenant Super Admin / Platform Owner via the FIXED `superAdminProcedure`
  // (+ a superAdmin-composed write) — NOT the matrix, because `users` is a
  // guardrail-forbidden feature (custom roles may never hold it; see
  // assertNoForbiddenFeatures). These rows are therefore DISPLAY-ONLY (the
  // role-builder ceiling / greyed-out display) and do NOT drive enforcement.
  // No `create` (no invite endpoint) or `delete` (no hard-delete endpoint) exists.
  users: { internalStaff: { view: true, create: false, update: true, delete: false } },

  // No billing/subscription router or mutation exists anywhere in the
  // codebase (plan.ts is `publicProcedure`, read-only plan listing). The
  // sidebar nav item (if any) is unfiltered like every other feature, so
  // `view` stays broad per the nav-visibility rule; there is no capability
  // to preserve for create/update/delete.
  billing: { internalStaff: { view: true, create: false, update: false, delete: false } },
};

/** Slugs from STANDARD_ROLES, kept local to avoid a circular import with ./roles. */
const CUSTOMER_ROLE_SLUG = 'customer';

/**
 * Resolves the matrix row for a given (non-bypass) role slug + feature.
 * Customer gets a hand-picked customer-facing subset; every other internal
 * role gets the feature's `internalStaff` default with any `roleOverrides`
 * for that slug merged in.
 */
function resolveRow(roleSlug: string, feature: FeatureKey): CUD {
  if (roleSlug === CUSTOMER_ROLE_SLUG) {
    // Customer role: 'portal.own' is its sole legacy permission (roles.ts).
    // The storefront (browseProducts/getProductById/placeOrder/
    // getOrderById/listMyOrders) is the only customer-facing surface — no
    // internal back-office feature is granted. `placeOrder` is ungated
    // writeProcedure (create=true); the admin-gated order-management
    // actions stay false, matching every other non-bypass role.
    if (feature === 'storefront') {
      return { view: true, create: true, update: false, delete: false };
    }
    return { ...NONE };
  }

  const def = FEATURE_DEFAULTS[feature];
  const override = def.roleOverrides?.[roleSlug];
  return { ...def.internalStaff, ...(override ?? {}) };
}

export interface BackfillRolePermissionsInput {
  tenantId: string;
  /** roleId keyed by slug — the same map built while seeding/provisioning roles. */
  roleIdBySlug: Readonly<Record<string, string>>;
}

/**
 * Backfill (idempotent upsert) the `role_permissions` matrix for every
 * STANDARD_ROLE in a tenant, reproducing today's name-based router gates.
 * Safe to re-run — upserts on the unique (tenantId, roleId, featureKey).
 */
export async function backfillRolePermissions(
  prisma: PrismaClient,
  input: BackfillRolePermissionsInput,
): Promise<{ rowsUpserted: number }> {
  const { tenantId, roleIdBySlug } = input;
  let rowsUpserted = 0;

  for (const [slug, roleId] of Object.entries(roleIdBySlug)) {
    const isBypass = BYPASS_ROLE_SLUGS.has(slug);

    for (const feature of FEATURE_KEYS) {
      const row = isBypass ? FULL : resolveRow(slug, feature);

      await prisma.rolePermission.upsert({
        where: {
          tenantId_roleId_featureKey: { tenantId, roleId, featureKey: feature },
        },
        update: row,
        create: { tenantId, roleId, featureKey: feature, ...row },
      });
      rowsUpserted++;
    }
  }

  return { rowsUpserted };
}
