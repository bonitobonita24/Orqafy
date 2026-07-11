/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
/**
 * Regression test for Bug B1: adminXenditConfigRouter, smtpConfigRouter, and
 * expenseCategoryRouter previously gated admin access on the role NAME
 * "Administrator", which no seeded role carries (the seeded admin role is
 * named "Admin" — see packages/db/src/seed/roles.ts). That silently 403'd
 * every real admin. This test asserts the fixed role gate:
 *   - "Admin" (the actual seeded role) is NOT rejected
 *   - a non-admin role IS rejected with FORBIDDEN
 *
 * The `get` reads on adminXenditConfigRouter/smtpConfigRouter are still
 * gated by the inline `requireRole` name-allowlist (Task 5.1 — deliberately
 * NOT migrated to the matrix, see admin-xendit-config.ts), so those cases
 * only need `ctx.roles`. `expenseCategoryRouter.create` HAS been migrated to
 * the data-driven `role_permissions` matrix (`matrixMiddleware("settings",
 * "create")`), so its gate is now resolved from `ctx.roleId` via the real
 * `hasPermission` resolver — "Admin" is not a bypass role, it is allowed only
 * because the Task 3.3 seed backfill grants it a matching `rolePermission`
 * row; a role with no such row (e.g. "Staff") is denied.
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi } from "vitest";
import type * as OrqafyDb from "@orqafy/db";

import { adminXenditConfigRouter } from "@/server/trpc/routers/admin-xendit-config";
import { smtpConfigRouter } from "@/server/trpc/routers/smtp-config";
import { expenseCategoryRouter } from "@/server/trpc/routers/expense-category";
import { createTRPCRouter, createCallerFactory } from "@/server/trpc/trpc";

vi.mock("@/server/lib/rate-limit", () => ({
  rateLimiters: {
    api: { check: vi.fn() },
    auth: { check: vi.fn() },
    upload: { check: vi.fn() },
    public: { check: vi.fn() },
  },
}));

// Keep the real `hasPermission` resolver (it takes prisma as an argument) —
// only mock the prisma client calls it (and the routers under test) make.
vi.mock("@orqafy/db", async () => {
  const actual = await vi.importActual<typeof OrqafyDb>("@orqafy/db");
  return {
    ...actual,
    prisma: {
      tenantXenditConfig: { findUnique: vi.fn().mockResolvedValue(null) },
      tenantSmtpConfig: { findUnique: vi.fn().mockResolvedValue(null) },
      role: { findFirst: vi.fn() },
      rolePermission: { findUnique: vi.fn() },
      expenseCategory: { findFirst: vi.fn(), create: vi.fn() },
    },
  };
});

import { prisma as db } from "@orqafy/db";
const mockDb = db as unknown as {
  role: { findFirst: any };
  rolePermission: { findUnique: any };
  expenseCategory: { findFirst: any; create: any };
};

// ---------------------------------------------------------------------------
// Context factory helpers
// ---------------------------------------------------------------------------
import type { NextRequest } from "next/server";

function makeReq(): NextRequest {
  return {} as NextRequest;
}

function ctxWithRoles(roles: string[], roleId: string | null = null) {
  return {
    req: makeReq(),
    userId: "user-1",
    roles,
    roleId,
    tenantSlug: "acme",
    tenantId: "acme-tenant-id",
    securityVersion: 1,
    isDemoTenant: false,
    session: null,
  };
}

const adminCtx = () => ctxWithRoles(["Admin"], "role-admin");
const nonAdminCtx = () => ctxWithRoles(["Staff"], "role-staff");

// ---------------------------------------------------------------------------
// adminXenditConfigRouter.get — read gate
// ---------------------------------------------------------------------------
describe("adminXenditConfigRouter role gate", () => {
  const router = createTRPCRouter({ adminXenditConfig: adminXenditConfigRouter });

  it("allows the seeded 'Admin' role through", async () => {
    const caller = createCallerFactory(router)(adminCtx());
    await expect(caller.adminXenditConfig.get()).resolves.toBeNull();
  });

  it("rejects a non-admin role with FORBIDDEN", async () => {
    const caller = createCallerFactory(router)(nonAdminCtx());
    await expect(caller.adminXenditConfig.get()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

// ---------------------------------------------------------------------------
// smtpConfigRouter.get — read gate
// ---------------------------------------------------------------------------
describe("smtpConfigRouter role gate", () => {
  const router = createTRPCRouter({ smtpConfig: smtpConfigRouter });

  it("allows the seeded 'Admin' role through", async () => {
    const caller = createCallerFactory(router)(adminCtx());
    await expect(caller.smtpConfig.get()).resolves.toBeNull();
  });

  it("rejects a non-admin role with FORBIDDEN", async () => {
    const caller = createCallerFactory(router)(nonAdminCtx());
    await expect(caller.smtpConfig.get()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

// ---------------------------------------------------------------------------
// expenseCategoryRouter.create — write gate, now matrix-driven (feature key
// "settings", action "create"). "list" is open to any authenticated user
// and untouched by this migration, so it is not covered here.
// ---------------------------------------------------------------------------
describe("expenseCategoryRouter role gate", () => {
  const router = createTRPCRouter({ expenseCategory: expenseCategoryRouter });

  it("rejects a non-admin role with FORBIDDEN (no matching matrix grant)", async () => {
    mockDb.role.findFirst.mockResolvedValue({
      id: "role-staff",
      tenantId: "acme-tenant-id",
      name: "Staff",
    });
    mockDb.rolePermission.findUnique.mockResolvedValue(null);

    const caller = createCallerFactory(router)(nonAdminCtx());
    await expect(
      caller.expenseCategory.create({ name: "Office Supplies", code: "OFFICE" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("does NOT reject the seeded 'Admin' role at the role-gate step", async () => {
    // "Admin" is not a matrix-bypass role — it is allowed through the gate
    // because the seed backfill grants it a matching rolePermission row.
    // Once past the gate, mock the router's own DB calls far enough to prove
    // the create actually proceeds (no code conflict, insert succeeds).
    mockDb.role.findFirst.mockResolvedValue({
      id: "role-admin",
      tenantId: "acme-tenant-id",
      name: "Admin",
    });
    mockDb.rolePermission.findUnique.mockResolvedValue({
      view: true,
      create: true,
      update: true,
      delete: true,
    });
    mockDb.expenseCategory.findFirst.mockResolvedValue(null);
    mockDb.expenseCategory.create.mockResolvedValue({
      id: "expense-category-1",
      name: "Office Supplies",
      code: "OFFICE",
    });

    const caller = createCallerFactory(router)(adminCtx());
    await expect(
      caller.expenseCategory.create({ name: "Office Supplies", code: "OFFICE" }),
    ).resolves.toMatchObject({ id: "expense-category-1" });
  });
});
