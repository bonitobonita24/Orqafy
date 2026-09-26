/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ORQ-36 — second-layer (defense-in-depth) tenant session guard for the staff
// (app) surface. These tests pin that the helper mirrors apps/web/src/middleware.ts
// semantics exactly, except that a cross-tenant request 404s (no tenant-existence
// leak) instead of bouncing to the caller's own dashboard.

vi.mock("server-only", () => ({}));

const authMock = vi.fn();
vi.mock("@/server/auth", () => ({ auth: () => authMock() }));

class RedirectSignal extends Error {
  constructor(public url: string) {
    super(`NEXT_REDIRECT:${url}`);
  }
}
class NotFoundSignal extends Error {
  constructor() {
    super("NEXT_NOT_FOUND");
  }
}
const redirectMock = vi.fn((url: string) => {
  throw new RedirectSignal(url);
});
const notFoundMock = vi.fn(() => {
  throw new NotFoundSignal();
});
vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
  notFound: () => notFoundMock(),
}));

import {
  resolveTenantSessionDecision,
  requireTenantSession,
} from "../require-tenant-session";

function staffSession(overrides: Record<string, unknown> = {}, userOverrides: Record<string, unknown> = {}) {
  return {
    principalType: "staff",
    user: {
      id: "user-1",
      roles: ["Tenant Admin"],
      roleId: "role-1",
      tenantSlug: "acme",
      tenantId: "tenant-acme",
      securityVersion: 1,
      isDemoTenant: false,
      ...userOverrides,
    },
    ...overrides,
  } as any;
}

describe("resolveTenantSessionDecision (pure)", () => {
  it("no session → redirect to /login (middleware's login target)", () => {
    expect(resolveTenantSessionDecision(null, "acme")).toEqual({ kind: "redirect", url: "/login" });
    expect(resolveTenantSessionDecision(undefined, "acme")).toEqual({ kind: "redirect", url: "/login" });
  });

  it("top-level SESSION_INVALIDATED (staff shape from config.ts) → /login?error=session_expired", () => {
    expect(resolveTenantSessionDecision(staffSession({ error: "SESSION_INVALIDATED" }), "acme")).toEqual({
      kind: "redirect",
      url: "/login?error=session_expired",
    });
  });

  it("user-level SESSION_INVALIDATED → /login?error=session_expired", () => {
    expect(
      resolveTenantSessionDecision(staffSession({}, { error: "SESSION_INVALIDATED" }), "acme"),
    ).toEqual({ kind: "redirect", url: "/login?error=session_expired" });
  });

  it("customer (portal) principal on a staff route → redirect to /{slug}/portal (same as middleware isolation)", () => {
    const customer = staffSession({ principalType: "customer", customerId: "cust-1" }, { id: "", roles: [] });
    expect(resolveTenantSessionDecision(customer, "acme")).toEqual({
      kind: "redirect",
      url: "/acme/portal",
    });
  });

  it("customer principal is isolated even on the demo slug (isolation runs before the demo fast-path)", () => {
    const customer = staffSession(
      { principalType: "customer", customerId: "cust-1" },
      { id: "", roles: [], tenantSlug: "demo" },
    );
    expect(resolveTenantSessionDecision(customer, "demo")).toEqual({
      kind: "redirect",
      url: "/demo/portal",
    });
  });

  it("staff session whose tenant ≠ URL slug → notFound (no tenant-existence leak)", () => {
    expect(resolveTenantSessionDecision(staffSession(), "globex")).toEqual({ kind: "notFound" });
  });

  it("Platform Owner gets NO cross-tenant exemption (middleware grants none)", () => {
    const owner = staffSession({}, { roles: ["Platform Owner"] });
    expect(resolveTenantSessionDecision(owner, "globex")).toEqual({ kind: "notFound" });
  });

  it("Platform Owner on its own tenant slug → allowed", () => {
    const owner = staffSession({}, { roles: ["Platform Owner"] });
    const d = resolveTenantSessionDecision(owner, "acme");
    expect(d.kind).toBe("allow");
  });

  it("staff session with no tenant slug → notFound (fail closed)", () => {
    expect(resolveTenantSessionDecision(staffSession({}, { tenantSlug: "" }), "acme")).toEqual({
      kind: "notFound",
    });
    expect(resolveTenantSessionDecision(staffSession({}, { tenantSlug: undefined }), "acme")).toEqual({
      kind: "notFound",
    });
  });

  it("staff session with no user id → redirect to /login (fail closed)", () => {
    expect(resolveTenantSessionDecision(staffSession({}, { id: "" }), "acme")).toEqual({
      kind: "redirect",
      url: "/login",
    });
  });

  it("demo slug: any authenticated staff may enter (middleware demo fast-path)", () => {
    const d = resolveTenantSessionDecision(staffSession(), "demo");
    expect(d.kind).toBe("allow");
  });

  it("suspended tenant (tenantIsActive === false) → /login?error=tenant_suspended", () => {
    expect(
      resolveTenantSessionDecision(staffSession({}, { tenantIsActive: false }), "acme"),
    ).toEqual({ kind: "redirect", url: "/login?error=tenant_suspended" });
  });

  it("correct tenant → allow with the verified server-side context", () => {
    expect(resolveTenantSessionDecision(staffSession(), "acme")).toEqual({
      kind: "allow",
      context: {
        userId: "user-1",
        tenantId: "tenant-acme",
        tenantSlug: "acme",
        roles: ["Tenant Admin"],
        roleId: "role-1",
        isDemoTenant: false,
        urlSlug: "acme",
      },
    });
  });
});

describe("requireTenantSession (wired to auth() + next/navigation)", () => {
  beforeEach(() => {
    authMock.mockReset();
    redirectMock.mockClear();
    notFoundMock.mockClear();
  });

  it("no session → calls redirect('/login') and never returns", async () => {
    authMock.mockResolvedValue(null);
    await expect(requireTenantSession("acme")).rejects.toBeInstanceOf(RedirectSignal);
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("wrong tenant → calls notFound()", async () => {
    authMock.mockResolvedValue(staffSession());
    await expect(requireTenantSession("globex")).rejects.toBeInstanceOf(NotFoundSignal);
    expect(notFoundMock).toHaveBeenCalledTimes(1);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("portal principal → redirect to /{slug}/portal", async () => {
    authMock.mockResolvedValue(staffSession({ principalType: "customer", customerId: "c" }, { id: "" }));
    await expect(requireTenantSession("acme")).rejects.toBeInstanceOf(RedirectSignal);
    expect(redirectMock).toHaveBeenCalledWith("/acme/portal");
  });

  it("correct tenant → resolves the verified context", async () => {
    authMock.mockResolvedValue(staffSession());
    await expect(requireTenantSession("acme")).resolves.toMatchObject({
      userId: "user-1",
      tenantId: "tenant-acme",
      tenantSlug: "acme",
    });
    expect(redirectMock).not.toHaveBeenCalled();
    expect(notFoundMock).not.toHaveBeenCalled();
  });
});
