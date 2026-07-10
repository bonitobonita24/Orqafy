/**
 * Regression test for Bug B1: adminXenditConfigRouter, smtpConfigRouter, and
 * expenseCategoryRouter previously gated admin access on the role NAME
 * "Administrator", which no seeded role carries (the seeded admin role is
 * named "Admin" — see packages/db/src/seed/roles.ts). That silently 403'd
 * every real admin. This test asserts the fixed role gate:
 *   - "Admin" (the actual seeded role) is NOT rejected
 *   - a non-admin role IS rejected with FORBIDDEN
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */

import { describe, it, expect, vi } from "vitest";

import { adminXenditConfigRouter } from "@/server/trpc/routers/admin-xendit-config";
import { smtpConfigRouter } from "@/server/trpc/routers/smtp-config";
import { expenseCategoryRouter } from "@/server/trpc/routers/expense-category";
import { createTRPCRouter, createCallerFactory } from "@/server/trpc/trpc";

vi.mock("@orqafy/db", () => ({
  prisma: {
    tenantXenditConfig: { findUnique: vi.fn().mockResolvedValue(null) },
    tenantSmtpConfig: { findUnique: vi.fn().mockResolvedValue(null) },
  },
}));

// ---------------------------------------------------------------------------
// Context factory helpers
// ---------------------------------------------------------------------------
import type { NextRequest } from "next/server";

function makeReq(): NextRequest {
  return {} as NextRequest;
}

function ctxWithRoles(roles: string[]) {
  return {
    req: makeReq(),
    userId: "user-1",
    roles,
    tenantSlug: "acme",
    tenantId: "acme-tenant-id",
    securityVersion: 1,
    isDemoTenant: false,
    session: null,
  };
}

const adminCtx = () => ctxWithRoles(["Admin"]);
const nonAdminCtx = () => ctxWithRoles(["Staff"]);

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
// expenseCategoryRouter.create — write gate (list is open to any authenticated
// user, so the write gate is the one that previously used "Administrator")
// ---------------------------------------------------------------------------
describe("expenseCategoryRouter role gate", () => {
  const router = createTRPCRouter({ expenseCategory: expenseCategoryRouter });

  it("rejects a non-admin role with FORBIDDEN (does not reach the DB)", async () => {
    const caller = createCallerFactory(router)(nonAdminCtx());
    await expect(
      caller.expenseCategory.create({ name: "Office Supplies", code: "OFFICE" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("does NOT reject the seeded 'Admin' role at the role-gate step", async () => {
    // We only assert the role gate lets Admin through — it should fail later
    // (DB not mocked for this router) rather than at the FORBIDDEN role check.
    const caller = createCallerFactory(router)(adminCtx());
    await expect(
      caller.expenseCategory.create({ name: "Office Supplies", code: "OFFICE" }),
    ).rejects.not.toMatchObject({ code: "FORBIDDEN" });
  });
});
