/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
/**
 * K-prime closure — SmtpConfig tenant parity
 *
 * Proves:
 *  1. smtpConfig.get returns null when no config exists for the tenant
 *  2. smtpConfig.upsert injects tenantId from ctx into db.tenantSmtpConfig.upsert
 *  3. smtpConfig.delete throws NOT_FOUND when no config exists for the tenant
 *  4. smtpConfig.get never returns the raw passwordEnc field (only hasPassword boolean)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// ── DB mock (hoisted so vi.mock factory can reference) ────────────────────────
const { mockSmtpFindUnique, mockSmtpUpsert, mockSmtpDelete } = vi.hoisted(() => ({
  mockSmtpFindUnique: vi.fn(),
  mockSmtpUpsert: vi.fn(),
  mockSmtpDelete: vi.fn(),
}));

vi.mock("@orqafy/db", () => ({
  prisma: {
    tenantSmtpConfig: {
      findUnique: mockSmtpFindUnique,
      upsert: mockSmtpUpsert,
      update: vi.fn(),
      delete: mockSmtpDelete,
    },
  },
}));

// Crypto: test the tenantId contract, not the encryption algorithm
vi.mock("@/lib/crypto", () => ({
  encrypt: (v: string) => `enc:${v}`,
  decrypt: (v: string) => v.replace(/^enc:/, ""),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { smtpConfigRouter } from "@/server/trpc/routers/smtp-config";
import { createTRPCRouter, createCallerFactory } from "@/server/trpc/trpc";

const testRouter = createTRPCRouter({ smtpConfig: smtpConfigRouter });
const createCaller = createCallerFactory(testRouter);

function makeReq(): NextRequest {
  return {} as NextRequest;
}

function ctxForTenant(tenantId: string) {
  return {
    req: makeReq(),
    userId: "user-1",
    roles: ["Admin"] as string[],
    tenantSlug: "test",
    tenantId,
    securityVersion: 1,
    isDemoTenant: false,
    session: null,
  };
}

const validUpsertInput = {
  host: "smtp.example.com",
  port: 587,
  username: "user@example.com",
  password: "secret123",
  fromAddress: "noreply@example.com",
  fromName: "Example Co",
  useTls: true,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("SmtpConfig tenant parity (K-prime closure)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("smtpConfig.get returns null when no config exists for tenant", async () => {
    mockSmtpFindUnique.mockResolvedValueOnce(null);

    const caller = createCaller(ctxForTenant("tenant-A"));
    const result = await caller.smtpConfig.get();

    expect(result).toBeNull();
  });

  it("smtpConfig.get never exposes passwordEnc — only hasPassword boolean", async () => {
    mockSmtpFindUnique.mockResolvedValueOnce({
      id: "clh3smtp000hxog4d8e5f9aa",
      tenantId: "tenant-A",
      host: "smtp.example.com",
      port: 587,
      username: "user@example.com",
      passwordEnc: "enc:topsecret",
      fromAddress: "noreply@example.com",
      fromName: "Example Co",
      useTls: true,
      isVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const caller = createCaller(ctxForTenant("tenant-A"));
    const result = await caller.smtpConfig.get();

    expect(result).not.toBeNull();
    // Must not expose the raw encrypted password
    expect(result).not.toHaveProperty("passwordEnc");
    // Must expose the safe boolean flag
    expect(result!.hasPassword).toBe(true);
  });

  it("smtpConfig.upsert injects tenantId from ctx and encrypts password before storage", async () => {
    const upsertedRow = {
      id: "clh3smtp001hxog4d8e5f9ab",
      tenantId: "tenant-A",
      host: validUpsertInput.host,
      port: validUpsertInput.port,
      username: validUpsertInput.username,
      passwordEnc: "enc:secret123",
      fromAddress: validUpsertInput.fromAddress,
      fromName: validUpsertInput.fromName,
      useTls: true,
      isVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockSmtpUpsert.mockResolvedValueOnce(upsertedRow);

    const caller = createCaller(ctxForTenant("tenant-A"));
    await caller.smtpConfig.upsert(validUpsertInput);

    expect(mockSmtpUpsert).toHaveBeenCalledOnce();
    const callArg = mockSmtpUpsert.mock.calls[0]![0];
    // where clause must use ctx.tenantId
    expect(callArg.where.tenantId).toBe("tenant-A");
    // create block must also pin tenantId from ctx
    expect(callArg.create.tenantId).toBe("tenant-A");
    // password must be stored encrypted, never plain-text
    expect(callArg.create.passwordEnc).toBe("enc:secret123");
    expect(callArg.create).not.toHaveProperty("password");
  });

  it("smtpConfig.delete throws NOT_FOUND when no config exists for the tenant", async () => {
    mockSmtpFindUnique.mockResolvedValueOnce(null);

    const caller = createCaller(ctxForTenant("tenant-A"));

    await expect(caller.smtpConfig.delete()).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "No SMTP configuration to delete.",
    });
  });
});
