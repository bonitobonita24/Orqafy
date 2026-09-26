/**
 * ORQ-35 — both tenant-creation paths (the /register server action and the
 * registration tRPC router) must reject slugs that collide with public paths
 * or matcher-excluded prefixes, server-side.
 */
/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@orqafy/db", () => ({
  prisma: {
    tenant: { findFirst: vi.fn(), create: vi.fn() },
    plan: { findFirst: vi.fn() },
  },
}));

vi.mock("@orqafy/jobs", () => ({
  createQueues: vi.fn(() => ({
    tenantProvisioning: { add: vi.fn().mockResolvedValue({ id: "job-1" }) },
  })),
}));

vi.mock("@/server/jobs/connection", () => ({ jobConnection: vi.fn(() => ({})) }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

import { prisma } from "@orqafy/db";
import { registerTenant } from "@/app/register/actions";
import { registrationRouter } from "@/server/trpc/routers/registration";
import { createCallerFactory, createTRPCRouter } from "@/server/trpc/trpc";
import type { NextRequest } from "next/server";

// ("tm" is reserved too but already fails the 3-char minimum.)
const COLLIDING = ["brand", "invoice", "privacy", "demo-login", "apiary"];

const baseInput = {
  name: "Evil Corp",
  plan: "starter",
  ownerEmail: "x@example.com",
  ownerName: "X",
  ownerPassword: "Secure123!@#",
};

function caller() {
  const router = createTRPCRouter({ registration: registrationRouter });
  const ctx = {
    req: {} as NextRequest,
    userId: null,
    roles: [],
    tenantSlug: null,
    tenantId: null,
    securityVersion: 0,
    isDemoTenant: false,
    session: null,
  };
  return createCallerFactory(router)(ctx);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.tenant.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.plan.findFirst).mockResolvedValue({ id: "plan-1" } as never);
  vi.mocked(prisma.tenant.create).mockResolvedValue({
    id: "t1", slug: "x", name: "x", schemaName: "t_x",
  } as never);
});

describe("registerTenant server action", () => {
  it.each(COLLIDING)("rejects reserved slug %s without creating a tenant", async (slug) => {
    const res = await registerTenant({ ...baseInput, slug });
    expect(res.error).toMatch(/reserved/i);
    expect(prisma.tenant.create).not.toHaveBeenCalled();
  });
});

describe("registration tRPC router", () => {
  it.each(COLLIDING)("validateSlug marks %s reserved", async (slug) => {
    const res = await caller().registration.validateSlug({ slug });
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/reserved/i);
  });

  it.each(COLLIDING)("createTenant rejects %s with BAD_REQUEST", async (slug) => {
    await expect(caller().registration.createTenant({ ...baseInput, slug })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(prisma.tenant.create).not.toHaveBeenCalled();
  });
});
