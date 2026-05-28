/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await */
// Batch 21c: webhook resolves tenant via order.tenantId then verifies the
// presented x-callback-token against the decrypted per-tenant webhookTokenEnc.
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import type { NextRequest } from "next/server";

// Crypto needs APP_ENCRYPTION_KEY at module-load time (lazy read in helper).
const VALID_KEY = Buffer.alloc(32, "k").toString("base64");
const ORIGINAL_KEY = process.env.APP_ENCRYPTION_KEY;
process.env.APP_ENCRYPTION_KEY = VALID_KEY;

vi.mock("@orqafy/db", () => ({
  prisma: {
    ecommerceOrder: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    tenantXenditConfig: {
      findUnique: vi.fn(),
    },
  },
}));

import { POST } from "@/app/api/webhooks/xendit/route";
import { prisma as db } from "@orqafy/db";
import { encrypt } from "@/lib/crypto";

const mockDb = db as unknown as {
  ecommerceOrder: { findUnique: any; update: any };
  tenantXenditConfig: { findUnique: any };
};

const ORDER_ID = "ck1234567890123456789012g";
const INVOICE_ID = "xendit-inv-001";
const TENANT_ID = "tenant-aaaa";
const VALID_TOKEN = "test-webhook-token";

const VALID_BODY = {
  id: INVOICE_ID,
  external_id: ORDER_ID,
  status: "PAID",
  paid_amount: 1500,
} as const;

function makeReq(opts: {
  token?: string | null;
  body?: unknown;
  invalidJson?: boolean;
}): NextRequest {
  return {
    headers: {
      get: (h: string): string | null => {
        if (h === "x-callback-token") return opts.token ?? null;
        return null;
      },
    },
    json: async (): Promise<unknown> => {
      if (opts.invalidJson === true) throw new Error("Invalid JSON");
      return opts.body;
    },
  } as unknown as NextRequest;
}

function orderRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ORDER_ID,
    tenantId: TENANT_ID,
    totalAmount: 1500,
    paymentStatus: "pending",
    xenditPaymentId: INVOICE_ID,
    webhookProcessedAt: null,
    ...overrides,
  };
}

function configRow(tokenPlain: string, isVerified = true) {
  return {
    id: "cfg-1",
    tenantId: TENANT_ID,
    secretKeyEnc: encrypt("xnd_secret_test"),
    publicKey: "xnd_public_test",
    webhookTokenEnc: encrypt(tokenPlain),
    isLive: false,
    isVerified,
    enabledMethods: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
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

describe("POST /api/webhooks/xendit", () => {
  it("returns 401 when x-callback-token header is missing (early exit, no DB hit)", async () => {
    const res = await POST(makeReq({ token: null, body: VALID_BODY }));
    expect(res.status).toBe(401);
    expect(mockDb.ecommerceOrder.findUnique).not.toHaveBeenCalled();
    expect(mockDb.tenantXenditConfig.findUnique).not.toHaveBeenCalled();
  });

  it("returns 401 when x-callback-token does not match the per-tenant webhook token", async () => {
    mockDb.ecommerceOrder.findUnique.mockResolvedValue(orderRow());
    mockDb.tenantXenditConfig.findUnique.mockResolvedValue(
      configRow(VALID_TOKEN),
    );

    const res = await POST(makeReq({ token: "wrong-token", body: VALID_BODY }));
    expect(res.status).toBe(401);
    expect(mockDb.ecommerceOrder.update).not.toHaveBeenCalled();
  });

  it("returns 400 when payload is missing required fields", async () => {
    const res = await POST(
      makeReq({
        token: VALID_TOKEN,
        body: { external_id: "x" }, // missing status + id
      }),
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toMatch(/missing required/i);
  });

  it("updates paymentStatus to paid on PAID webhook (happy path)", async () => {
    mockDb.ecommerceOrder.findUnique.mockResolvedValue(orderRow());
    mockDb.tenantXenditConfig.findUnique.mockResolvedValue(
      configRow(VALID_TOKEN),
    );
    mockDb.ecommerceOrder.update.mockResolvedValue({});

    const res = await POST(makeReq({ token: VALID_TOKEN, body: VALID_BODY }));

    expect(res.status).toBe(200);
    const updateCall = mockDb.ecommerceOrder.update.mock.calls[0][0];
    expect(updateCall.where.id).toBe(ORDER_ID);
    expect(updateCall.data.paymentStatus).toBe("paid");
    // Tenant config lookup must be scoped by the order's tenantId.
    expect(mockDb.tenantXenditConfig.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: TENANT_ID } }),
    );
  });

  it("writes webhookProcessedAt timestamp on successful PAID webhook", async () => {
    mockDb.ecommerceOrder.findUnique.mockResolvedValue(orderRow());
    mockDb.tenantXenditConfig.findUnique.mockResolvedValue(
      configRow(VALID_TOKEN),
    );

    const before = Date.now();
    await POST(makeReq({ token: VALID_TOKEN, body: VALID_BODY }));
    const after = Date.now();

    expect(mockDb.ecommerceOrder.update).toHaveBeenCalledOnce();
    const updateCall = mockDb.ecommerceOrder.update.mock.calls[0][0];
    expect(updateCall.data.webhookProcessedAt).toBeInstanceOf(Date);
    const ts = (updateCall.data.webhookProcessedAt as Date).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it("returns 200 idempotent on duplicate webhook (order already paid)", async () => {
    mockDb.ecommerceOrder.findUnique.mockResolvedValue(
      orderRow({ paymentStatus: "paid" }),
    );
    mockDb.tenantXenditConfig.findUnique.mockResolvedValue(
      configRow(VALID_TOKEN),
    );

    const res = await POST(makeReq({ token: VALID_TOKEN, body: VALID_BODY }));

    expect(res.status).toBe(200);
    expect(mockDb.ecommerceOrder.update).not.toHaveBeenCalled();
  });

  it("returns 400 on amount mismatch (defence-in-depth)", async () => {
    mockDb.ecommerceOrder.findUnique.mockResolvedValue(orderRow());
    mockDb.tenantXenditConfig.findUnique.mockResolvedValue(
      configRow(VALID_TOKEN),
    );

    const res = await POST(
      makeReq({
        token: VALID_TOKEN,
        body: { ...VALID_BODY, paid_amount: 9999 }, // wrong amount
      }),
    );

    expect(res.status).toBe(400);
    expect(mockDb.ecommerceOrder.update).not.toHaveBeenCalled();
  });

  it("returns 400 when invoice id does not match stored xenditPaymentId", async () => {
    mockDb.ecommerceOrder.findUnique.mockResolvedValue(
      orderRow({ xenditPaymentId: "different-invoice-id" }),
    );
    mockDb.tenantXenditConfig.findUnique.mockResolvedValue(
      configRow(VALID_TOKEN),
    );

    const res = await POST(makeReq({ token: VALID_TOKEN, body: VALID_BODY }));

    expect(res.status).toBe(400);
    expect(mockDb.ecommerceOrder.update).not.toHaveBeenCalled();
  });

  it("maps EXPIRED to paymentStatus=failed", async () => {
    mockDb.ecommerceOrder.findUnique.mockResolvedValue(orderRow());
    mockDb.tenantXenditConfig.findUnique.mockResolvedValue(
      configRow(VALID_TOKEN),
    );
    mockDb.ecommerceOrder.update.mockResolvedValue({});

    const res = await POST(
      makeReq({
        token: VALID_TOKEN,
        body: { id: INVOICE_ID, external_id: ORDER_ID, status: "EXPIRED" },
      }),
    );

    expect(res.status).toBe(200);
    const updateCall = mockDb.ecommerceOrder.update.mock.calls[0][0];
    expect(updateCall.data.paymentStatus).toBe("failed");
  });
});
