/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await */
// Batch 21c — per-tenant Xendit refactor (Direction F split 3 of 3).
// Covers the new behaviors NOT exercised by storefront.test.ts / xendit-webhook.test.ts:
//   1. getXenditClient(tenantId) throws when no TenantXenditConfig row exists
//   2. getXenditClient(tenantId) throws when isVerified=false (force admin verify gate)
//   3. webhook rejects when xenditPaymentId resolves to a tenant whose webhookToken
//      does not match the one presented in x-callback-token (cross-tenant token leak)
//   4. webhook returns 401 (not 200, not 404) when xenditPaymentId resolves to no
//      order — same status as wrong-token to prevent enumeration of valid order ids
//   5. cross-tenant explicit: tenant A's token cannot validate tenant B's webhook,
//      AND the same body validates cleanly with tenant B's actual token

import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import type { NextRequest } from "next/server";

// Lazy-read crypto — set APP_ENCRYPTION_KEY before module load.
const VALID_KEY = Buffer.alloc(32, "k").toString("base64");
const ORIGINAL_KEY = process.env.APP_ENCRYPTION_KEY;
process.env.APP_ENCRYPTION_KEY = VALID_KEY;

vi.mock("@orqafy/db", () => ({
  prisma: {
    tenantXenditConfig: {
      findUnique: vi.fn(),
    },
    ecommerceOrder: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma as db } from "@orqafy/db";
import { encrypt } from "@/lib/crypto";
import { POST } from "@/app/api/webhooks/xendit/route";
import { getXenditClient } from "@/lib/xendit";

const mockDb = db as unknown as {
  tenantXenditConfig: { findUnique: any };
  ecommerceOrder: { findUnique: any; update: any };
};

const TENANT_A = "tenant-aaaa";
const TENANT_B = "tenant-bbbb";
const ORDER_ID = "ck1234567890123456789012g";
const INVOICE_ID = "xendit-inv-001";
const SECRET_A = "xnd_secret_tenantA";
const SECRET_B = "xnd_secret_tenantB";
const TOKEN_A = "webhook-token-tenant-A";
const TOKEN_B = "webhook-token-tenant-B";

function tenantConfigRow(tenantId: string, secretPlain: string, tokenPlain: string, isVerified = true) {
  return {
    id: `cfg-${tenantId}`,
    tenantId,
    secretKeyEnc: encrypt(secretPlain),
    publicKey: `xnd_public_${tenantId}`,
    webhookTokenEnc: encrypt(tokenPlain),
    isLive: false,
    isVerified,
    enabledMethods: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeReq(opts: { token?: string | null; body?: unknown }): NextRequest {
  return {
    headers: {
      get: (h: string): string | null => {
        if (h === "x-callback-token") return opts.token ?? null;
        return null;
      },
    },
    json: async (): Promise<unknown> => opts.body,
  } as unknown as NextRequest;
}

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

describe("getXenditClient(tenantId) — per-tenant resolution", () => {
  it("throws when no TenantXenditConfig exists for the tenant", async () => {
    mockDb.tenantXenditConfig.findUnique.mockResolvedValue(null);

    await expect(getXenditClient(TENANT_A)).rejects.toThrow(
      /not configured|not found/i,
    );
    expect(mockDb.tenantXenditConfig.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: TENANT_A } }),
    );
  });

  it("throws when TenantXenditConfig exists but isVerified=false (force verify gate)", async () => {
    mockDb.tenantXenditConfig.findUnique.mockResolvedValue(
      tenantConfigRow(TENANT_A, SECRET_A, TOKEN_A, /* isVerified */ false),
    );

    await expect(getXenditClient(TENANT_A)).rejects.toThrow(/not verified/i);
  });
});

describe("POST /api/webhooks/xendit — per-tenant resolution", () => {
  const VALID_BODY = {
    id: INVOICE_ID,
    external_id: ORDER_ID,
    status: "PAID",
    paid_amount: 1500,
  };

  it("returns 401 when xenditPaymentId does not resolve to any order (no enumeration leak)", async () => {
    mockDb.ecommerceOrder.findUnique.mockResolvedValue(null);

    const res = await POST(makeReq({ token: TOKEN_A, body: VALID_BODY }));
    // 401 (NOT 200, NOT 404) — same status as wrong-token so the attacker cannot
    // distinguish "wrong order id" from "wrong token" by status code.
    expect(res.status).toBe(401);
    // Must not have proceeded to a config lookup if no order resolved.
    expect(mockDb.tenantXenditConfig.findUnique).not.toHaveBeenCalled();
    expect(mockDb.ecommerceOrder.update).not.toHaveBeenCalled();
  });

  it("returns 401 when presented token matches a DIFFERENT tenant than the order's tenant", async () => {
    // Order belongs to tenant B.
    mockDb.ecommerceOrder.findUnique.mockResolvedValue({
      id: ORDER_ID,
      tenantId: TENANT_B,
      totalAmount: 1500,
      paymentStatus: "pending",
      xenditPaymentId: INVOICE_ID,
    });
    // The lookup for tenant B's config returns tenant B's token.
    mockDb.tenantXenditConfig.findUnique.mockImplementation(
      ({ where }: { where: { tenantId: string } }) =>
        Promise.resolve(
          where.tenantId === TENANT_B
            ? tenantConfigRow(TENANT_B, SECRET_B, TOKEN_B)
            : null,
        ),
    );

    // Attacker presents tenant A's token for tenant B's order.
    const res = await POST(makeReq({ token: TOKEN_A, body: VALID_BODY }));
    expect(res.status).toBe(401);
    expect(mockDb.ecommerceOrder.update).not.toHaveBeenCalled();
  });

  it("cross-tenant: tenant A's token cannot validate tenant B's webhook; tenant B's token succeeds on same body", async () => {
    mockDb.ecommerceOrder.findUnique.mockResolvedValue({
      id: ORDER_ID,
      tenantId: TENANT_B,
      totalAmount: 1500,
      paymentStatus: "pending",
      xenditPaymentId: INVOICE_ID,
    });
    mockDb.tenantXenditConfig.findUnique.mockImplementation(
      ({ where }: { where: { tenantId: string } }) =>
        Promise.resolve(
          where.tenantId === TENANT_B
            ? tenantConfigRow(TENANT_B, SECRET_B, TOKEN_B)
            : null,
        ),
    );
    mockDb.ecommerceOrder.update.mockResolvedValue({});

    // Attacker — tenant A's token → 401.
    const attackerRes = await POST(
      makeReq({ token: TOKEN_A, body: VALID_BODY }),
    );
    expect(attackerRes.status).toBe(401);

    // Legitimate — tenant B's token on same body → 200.
    const legitRes = await POST(makeReq({ token: TOKEN_B, body: VALID_BODY }));
    expect(legitRes.status).toBe(200);
    expect(mockDb.ecommerceOrder.update).toHaveBeenCalledTimes(1);
    const updateCall = mockDb.ecommerceOrder.update.mock.calls[0][0];
    expect(updateCall.data.paymentStatus).toBe("paid");
  });
});
