/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

// `guard-page.ts` (and `server/trpc/server.ts`, which it does not import but
// mirrors) imports the "server-only" marker package. It is resolvable inside
// Next.js's own build graph but is not a direct dependency of apps/web, so it
// is not resolvable under plain Vitest/Node — stub it rather than add a new
// package dependency for a single test file.
vi.mock("server-only", () => ({}));

import { resolveGuardDecision, type GuardPageSessionInput } from "../guard-page";

function session(overrides: Partial<GuardPageSessionInput> = {}): GuardPageSessionInput {
  return {
    userId: "user-1",
    tenantId: "tenant-1",
    roleId: "role-1",
    sessionInvalidated: false,
    ...overrides,
  };
}

describe("resolveGuardDecision (pure decision logic)", () => {
  it("redirects to /login when there is no session", () => {
    const decision = resolveGuardDecision(
      session({ userId: null }),
      false,
      "acme",
      "settings",
    );
    expect(decision).toEqual({ kind: "redirect", url: "/login" });
  });

  it("redirects to /login when the session was invalidated", () => {
    const decision = resolveGuardDecision(
      session({ sessionInvalidated: true }),
      true, // even if somehow allowed=true, invalidated session must not render
      "acme",
      "settings",
    );
    expect(decision).toEqual({ kind: "redirect", url: "/login" });
  });

  it("redirects to the tenant dashboard with ?denied=<feature> when the matrix denies", () => {
    const decision = resolveGuardDecision(session(), false, "acme", "compliance");
    expect(decision).toEqual({
      kind: "redirect",
      url: "/acme/dashboard?denied=compliance",
    });
  });

  it("allows when a valid session and the matrix grants the permission", () => {
    const decision = resolveGuardDecision(session(), true, "acme", "dsr");
    expect(decision).toEqual({ kind: "allow" });
  });
});

// ---------------------------------------------------------------------------
// Integration-style test for guardPage() itself — mocks auth(), hasPermission(),
// and next/navigation's redirect() so the async wiring (session → matrix check
// → decision → redirect-or-return) is exercised end to end.
// ---------------------------------------------------------------------------

const mockAuth = vi.fn();
vi.mock("@/server/auth", () => ({
  auth: () => mockAuth(),
}));

const mockHasPermission = vi.fn();
vi.mock("@orqafy/db", () => ({
  prisma: {},
  hasPermission: (...args: unknown[]) => mockHasPermission(...args),
}));

const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (url: string) => mockRedirect(url),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("guardPage()", () => {
  it("redirects to /login and never calls hasPermission when there is no session", async () => {
    mockAuth.mockResolvedValue(null);
    const { guardPage } = await import("../guard-page");

    await guardPage("acme", "settings");

    expect(mockHasPermission).not.toHaveBeenCalled();
    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });

  it("redirects to the dashboard with ?denied=<feature> when hasPermission denies", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-1", tenantId: "tenant-1", roleId: "role-1" },
    });
    mockHasPermission.mockResolvedValue(false);
    const { guardPage } = await import("../guard-page");

    await guardPage("acme", "compliance");

    expect(mockHasPermission).toHaveBeenCalledWith(
      {},
      { tenantId: "tenant-1", roleId: "role-1", feature: "compliance", action: "view" },
    );
    expect(mockRedirect).toHaveBeenCalledWith("/acme/dashboard?denied=compliance");
  });

  it("does not redirect when hasPermission allows", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-1", tenantId: "tenant-1", roleId: "role-1" },
    });
    mockHasPermission.mockResolvedValue(true);
    const { guardPage } = await import("../guard-page");

    await guardPage("acme", "dsr");

    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
