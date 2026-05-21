/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/require-await */
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { TRPCError } from "@trpc/server";
import type { NextRequest } from "next/server";

// Encryption key — set BEFORE any router import so getKey() can read at call time.
const VALID_KEY = "tjmFm1xJiKHrSIfdoo3pUxg/JmTNuwI1WjVxoTSn0xc=";
const ORIGINAL_KEY = process.env.APP_ENCRYPTION_KEY;
process.env.APP_ENCRYPTION_KEY = VALID_KEY;

// ── DB Mock ───────────────────────────────────────────────────────────────────
vi.mock("@orqafy/db", () => ({
  prisma: {
    tenantXenditConfig: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    ecommerceOrder: {
      count: vi.fn(),
    },
  },
}));

// ── Rate-limit Mock ───────────────────────────────────────────────────────────
vi.mock("@/server/lib/rate-limit", () => ({
  rateLimiters: {
    api: { check: vi.fn() },
    public: { check: vi.fn() },
  },
}));

// ── Xendit SDK Mock ───────────────────────────────────────────────────────────
const { mockCreateInvoice, mockExpireInvoice, mockXenditCtor } = vi.hoisted(() => ({
  mockCreateInvoice: vi.fn(),
  mockExpireInvoice: vi.fn(),
  mockXenditCtor: vi.fn(),
}));
vi.mock("xendit-node", () => ({
  Xendit: vi.fn().mockImplementation((opts: unknown) => {
    mockXenditCtor(opts);
    return {
      Invoice: {
        createInvoice: mockCreateInvoice,
        expireInvoice: mockExpireInvoice,
      },
    };
  }),
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────
import { adminXenditConfigRouter } from "@/server/trpc/routers/admin-xendit-config";
import { createTRPCRouter, createCallerFactory } from "@/server/trpc/trpc";
import { encrypt, decrypt } from "@/lib/crypto";
import { prisma as db } from "@orqafy/db";

const mockDb = db as unknown as {
  tenantXenditConfig: {
    findUnique: any;
    upsert: any;
    update: any;
    delete: any;
  };
  ecommerceOrder: { count: any };
};

function makeReq(): NextRequest {
  return {
    headers: { get: (_h: string): string | null => null },
  } as unknown as NextRequest;
}

function authenticatedCtx(roles: string[] = ["Administrator"], isDemoTenant = false) {
  return {
    req: makeReq(),
    userId: "ck1234567890123456789012a",
    roles,
    tenantSlug: "test-tenant",
    tenantId: "ck1234567890123456789012b",
    securityVersion: 0,
    isDemoTenant,
    session: null,
  };
}

const testRouter = createTRPCRouter({ adminXenditConfig: adminXenditConfigRouter });
const createCaller = createCallerFactory(testRouter);

beforeEach(() => {
  vi.clearAllMocks();
});

afterAll(() => {
  if (ORIGINAL_KEY === undefined) {
    delete process.env.APP_ENCRYPTION_KEY;
  } else {
    process.env.APP_ENCRYPTION_KEY = ORIGINAL_KEY;
  }
});

describe("adminXenditConfig router", () => {
  describe("upsert", () => {
    it("encrypts secretKey and webhookToken before storing (roundtrip decrypt proves it)", async () => {
      mockDb.tenantXenditConfig.upsert.mockImplementation(async (args: any) => ({
        id: "cfg-1",
        tenantId: "ck1234567890123456789012b",
        ...args.create,
        isVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
      const caller = createCaller(authenticatedCtx());
      await caller.adminXenditConfig.upsert({
        secretKey: "xnd_production_secret_abc",
        publicKey: "xnd_public_xyz",
        webhookToken: "wh_token_def",
        isLive: true,
        enabledMethods: ["CARD", "EWALLET"],
      });
      const upsertCall = mockDb.tenantXenditConfig.upsert.mock.calls[0][0];
      const created = upsertCall.create;
      // Ciphertexts must NOT equal plaintexts
      expect(created.secretKeyEnc).not.toBe("xnd_production_secret_abc");
      expect(created.webhookTokenEnc).not.toBe("wh_token_def");
      // Roundtrip decrypt proves it was encrypted with our key
      expect(decrypt(created.secretKeyEnc)).toBe("xnd_production_secret_abc");
      expect(decrypt(created.webhookTokenEnc)).toBe("wh_token_def");
      // Public key NOT encrypted (it's a public token)
      expect(created.publicKey).toBe("xnd_public_xyz");
    });

    it("resets isVerified to false on every upsert (create AND update branch)", async () => {
      mockDb.tenantXenditConfig.upsert.mockResolvedValue({ id: "cfg-1" });
      const caller = createCaller(authenticatedCtx());
      await caller.adminXenditConfig.upsert({
        secretKey: "k",
        publicKey: "p",
        webhookToken: "t",
        isLive: false,
        enabledMethods: [],
      });
      const upsertCall = mockDb.tenantXenditConfig.upsert.mock.calls[0][0];
      expect(upsertCall.create.isVerified).toBe(false);
      expect(upsertCall.update.isVerified).toBe(false);
    });
  });

  describe("get", () => {
    it("never returns secretKeyEnc or webhookTokenEnc; returns has-value booleans instead", async () => {
      mockDb.tenantXenditConfig.findUnique.mockResolvedValue({
        id: "cfg-1",
        tenantId: "ck1234567890123456789012b",
        secretKeyEnc: encrypt("xnd_production_secret_abc"),
        publicKey: "xnd_public_xyz",
        webhookTokenEnc: encrypt("wh_token_def"),
        isLive: true,
        isVerified: true,
        enabledMethods: ["CARD"],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const caller = createCaller(authenticatedCtx());
      const res = await caller.adminXenditConfig.get();
      expect(res).not.toBeNull();
      expect(res).not.toHaveProperty("secretKeyEnc");
      expect(res).not.toHaveProperty("webhookTokenEnc");
      // Public-safe fields exposed
      expect(res?.publicKey).toBe("xnd_public_xyz");
      expect(res?.isLive).toBe(true);
      expect(res?.isVerified).toBe(true);
      expect(res?.enabledMethods).toEqual(["CARD"]);
      // Masked-display signals
      expect(res?.hasSecretKey).toBe(true);
      expect(res?.hasWebhookToken).toBe(true);
    });
  });

  describe("testConnection", () => {
    it("happy path: createInvoice + expireInvoice succeed → flips isVerified to true", async () => {
      mockDb.tenantXenditConfig.findUnique.mockResolvedValue({
        id: "cfg-1",
        tenantId: "ck1234567890123456789012b",
        secretKeyEnc: encrypt("xnd_real_secret"),
        publicKey: "xnd_real_public",
        webhookTokenEnc: encrypt("wh_real"),
        isLive: false,
        isVerified: false,
        enabledMethods: [],
      });
      mockCreateInvoice.mockResolvedValue({ id: "inv_test_123" });
      mockExpireInvoice.mockResolvedValue({ id: "inv_test_123", status: "EXPIRED" });
      mockDb.tenantXenditConfig.update.mockResolvedValue({ isVerified: true });

      const caller = createCaller(authenticatedCtx());
      const res = await caller.adminXenditConfig.testConnection();

      // Xendit SDK instantiated with DECRYPTED secret (not the encrypted blob)
      expect(mockXenditCtor).toHaveBeenCalledWith({ secretKey: "xnd_real_secret" });
      expect(mockCreateInvoice).toHaveBeenCalledTimes(1);
      expect(mockExpireInvoice).toHaveBeenCalledWith({ invoiceId: "inv_test_123" });
      expect(mockDb.tenantXenditConfig.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: "ck1234567890123456789012b" },
          data: { isVerified: true },
        }),
      );
      expect(res.isVerified).toBe(true);
    });

    it("failure: createInvoice throws → leaves isVerified false + propagates error", async () => {
      mockDb.tenantXenditConfig.findUnique.mockResolvedValue({
        id: "cfg-1",
        tenantId: "ck1234567890123456789012b",
        secretKeyEnc: encrypt("xnd_bad_secret"),
        publicKey: "x",
        webhookTokenEnc: encrypt("w"),
        isLive: false,
        isVerified: false,
        enabledMethods: [],
      });
      mockCreateInvoice.mockRejectedValue(new Error("UNAUTHORIZED"));

      const caller = createCaller(authenticatedCtx());
      await expect(caller.adminXenditConfig.testConnection()).rejects.toThrow();

      // isVerified was NEVER set to true
      const trueUpdates = mockDb.tenantXenditConfig.update.mock.calls.filter(
        (c: any) => c[0]?.data?.isVerified === true,
      );
      expect(trueUpdates.length).toBe(0);
    });
  });

  describe("delete", () => {
    it("blocked when EcommerceOrder.xenditPaymentId references exist", async () => {
      mockDb.tenantXenditConfig.findUnique.mockResolvedValue({ id: "cfg-1" });
      mockDb.ecommerceOrder.count.mockResolvedValue(3); // 3 dangling refs
      const caller = createCaller(authenticatedCtx());
      await expect(caller.adminXenditConfig.delete()).rejects.toThrow(TRPCError);
      expect(mockDb.tenantXenditConfig.delete).not.toHaveBeenCalled();
    });
  });

  describe("authorization", () => {
    it("rejects non-admin role on every procedure (FORBIDDEN)", async () => {
      const caller = createCaller(authenticatedCtx(["User"]));
      await expect(caller.adminXenditConfig.get()).rejects.toThrow(/FORBIDDEN/);
      await expect(
        caller.adminXenditConfig.upsert({
          secretKey: "k",
          publicKey: "p",
          webhookToken: "t",
          isLive: false,
          enabledMethods: [],
        }),
      ).rejects.toThrow(/FORBIDDEN/);
      await expect(caller.adminXenditConfig.testConnection()).rejects.toThrow(/FORBIDDEN/);
      await expect(caller.adminXenditConfig.delete()).rejects.toThrow(/FORBIDDEN/);
    });

    it("cross-tenant isolation: every query scoped to ctx.tenantId", async () => {
      mockDb.tenantXenditConfig.findUnique.mockResolvedValue(null);
      const caller = createCaller(authenticatedCtx(["Administrator"]));
      await caller.adminXenditConfig.get();
      expect(mockDb.tenantXenditConfig.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: "ck1234567890123456789012b" },
        }),
      );
    });
  });
});
