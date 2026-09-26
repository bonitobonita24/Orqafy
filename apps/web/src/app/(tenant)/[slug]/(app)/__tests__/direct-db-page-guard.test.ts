/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

// ORQ-36 — direct-Prisma pages under (tenant)/[slug]/(app) must verify the
// session + tenant themselves (second layer behind middleware.ts), BEFORE any
// DB read. Proven here by rendering real pages with auth() mocked.

vi.mock("server-only", () => ({}));

const authMock = vi.fn();
vi.mock("@/server/auth", () => ({ auth: () => authMock() }));

class RedirectSignal extends Error {
  constructor(public url: string) {
    super(`NEXT_REDIRECT:${url}`);
  }
}
class NotFoundSignal extends Error {}
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new RedirectSignal(url);
  },
  notFound: () => {
    throw new NotFoundSignal("NEXT_NOT_FOUND");
  },
}));

const tenantFindUnique = vi.fn();
const expenseFindMany = vi.fn();
vi.mock("@orqafy/db", () => ({
  prisma: {
    tenant: { findUnique: (...a: unknown[]) => tenantFindUnique(...a) },
    expense: { findMany: (...a: unknown[]) => expenseFindMany(...a) },
  },
}));

import ExpensesPage from "../expenses/page";

const params = (slug: string) => Promise.resolve({ slug });

describe("direct-DB page guard — expenses/page.tsx", () => {
  beforeEach(() => {
    authMock.mockReset();
    tenantFindUnique.mockReset();
    expenseFindMany.mockReset();
  });

  it("no session → redirects to /login and never queries Prisma", async () => {
    authMock.mockResolvedValue(null);
    await expect(ExpensesPage({ params: params("acme") })).rejects.toMatchObject({ url: "/login" });
    expect(tenantFindUnique).not.toHaveBeenCalled();
    expect(expenseFindMany).not.toHaveBeenCalled();
  });

  it("staff session for another tenant → notFound and never queries Prisma", async () => {
    authMock.mockResolvedValue({
      principalType: "staff",
      user: { id: "u1", tenantSlug: "globex", tenantId: "t-globex", roles: [], roleId: "r" },
    });
    await expect(ExpensesPage({ params: params("acme") })).rejects.toBeInstanceOf(NotFoundSignal);
    expect(tenantFindUnique).not.toHaveBeenCalled();
    expect(expenseFindMany).not.toHaveBeenCalled();
  });

  it("portal customer session → redirected to the portal, never queries Prisma", async () => {
    authMock.mockResolvedValue({
      principalType: "customer",
      customerId: "c1",
      user: { id: "", tenantSlug: "acme", tenantId: "t-acme", roles: [] },
    });
    await expect(ExpensesPage({ params: params("acme") })).rejects.toMatchObject({ url: "/acme/portal" });
    expect(tenantFindUnique).not.toHaveBeenCalled();
  });

  it("matching staff session → proceeds to the tenant lookup", async () => {
    authMock.mockResolvedValue({
      principalType: "staff",
      user: { id: "u1", tenantSlug: "acme", tenantId: "t-acme", roles: [], roleId: "r" },
    });
    tenantFindUnique.mockResolvedValue({ id: "t-acme" });
    expenseFindMany.mockResolvedValue([]);
    await ExpensesPage({ params: params("acme") });
    expect(tenantFindUnique).toHaveBeenCalledTimes(1);
    expect(expenseFindMany.mock.calls[0]?.[0]?.where).toEqual({ tenantId: "t-acme" });
  });
});

// Static sweep — every page/layout under (app) that imports @orqafy/db must
// call requireTenantSession(). Catches a NEW direct-DB page added without it.
describe("direct-DB page guard — static coverage sweep", () => {
  const appDir = path.resolve(__dirname, "..");

  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const full = path.join(dir, name);
      if (name === "__tests__" || name === "node_modules") return [];
      if (statSync(full).isDirectory()) return walk(full);
      return /\.(ts|tsx)$/.test(name) ? [full] : [];
    });
  }

  it("every (app) server file importing @orqafy/db calls requireTenantSession", () => {
    const offenders = walk(appDir)
      .filter((f) => {
        const src = readFileSync(f, "utf8");
        if (/^\s*["']use client["']/.test(src)) return false;
        return src.includes('from "@orqafy/db"') && !src.includes("requireTenantSession(");
      })
      .map((f) => path.relative(appDir, f));
    expect(offenders).toEqual([]);
  });

  it("the (app) layout calls requireTenantSession", () => {
    const layout = readFileSync(path.join(appDir, "layout.tsx"), "utf8");
    expect(layout).toContain("requireTenantSession(");
  });
});
