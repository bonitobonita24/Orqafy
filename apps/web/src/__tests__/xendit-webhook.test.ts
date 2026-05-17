/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("@/env", () => ({
  env: { XENDIT_WEBHOOK_TOKEN: "test-webhook-token" },
}));

vi.mock("@orqafy/db", () => ({
  prisma: {
    ecommerceOrder: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { POST } from "@/app/api/webhooks/xendit/route";
import { prisma as db } from "@orqafy/db";

const mockDb = db as unknown as {
  ecommerceOrder: { findUnique: any; update: any };
};

const ORDER_ID = "ck1234567890123456789012g";
const INVOICE_ID = "xendit-inv-001";
const VALID_TOKEN = "test-webhook-token";

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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/webhooks/xendit", () => {
  it("returns 401 when x-callback-token header is missing", async () => {
    const res = await POST(makeReq({ token: null, body: {} }));
    expect(res.status).toBe(401);
    expect(mockDb.ecommerceOrder.findUnique).not.toHaveBeenCalled();
  });

  it("returns 401 when x-callback-token does not match", async () => {
    const res = await POST(makeReq({ token: "wrong-token", body: {} }));
    expect(res.status).toBe(401);
    expect(mockDb.ecommerceOrder.findUnique).not.toHaveBeenCalled();
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
    mockDb.ecommerceOrder.findUnique.mockResolvedValue({
      id: ORDER_ID,
      totalAmount: 1500,
      paymentStatus: "pending",
      xenditPaymentId: INVOICE_ID,
    });
    mockDb.ecommerceOrder.update.mockResolvedValue({});

    const res = await POST(
      makeReq({
        token: VALID_TOKEN,
        body: {
          id: INVOICE_ID,
          external_id: ORDER_ID,
          status: "PAID",
          paid_amount: 1500,
        },
      }),
    );

    expect(res.status).toBe(200);
    const updateCall = mockDb.ecommerceOrder.update.mock.calls[0][0];
    expect(updateCall.where.id).toBe(ORDER_ID);
    expect(updateCall.data.paymentStatus).toBe("paid");
  });

  it("returns 200 idempotent on duplicate webhook (order already paid)", async () => {
    mockDb.ecommerceOrder.findUnique.mockResolvedValue({
      id: ORDER_ID,
      totalAmount: 1500,
      paymentStatus: "paid",
      xenditPaymentId: INVOICE_ID,
    });

    const res = await POST(
      makeReq({
        token: VALID_TOKEN,
        body: {
          id: INVOICE_ID,
          external_id: ORDER_ID,
          status: "PAID",
          paid_amount: 1500,
        },
      }),
    );

    expect(res.status).toBe(200);
    expect(mockDb.ecommerceOrder.update).not.toHaveBeenCalled();
  });

  it("returns 400 on amount mismatch (defence-in-depth)", async () => {
    mockDb.ecommerceOrder.findUnique.mockResolvedValue({
      id: ORDER_ID,
      totalAmount: 1500,
      paymentStatus: "pending",
      xenditPaymentId: INVOICE_ID,
    });

    const res = await POST(
      makeReq({
        token: VALID_TOKEN,
        body: {
          id: INVOICE_ID,
          external_id: ORDER_ID,
          status: "PAID",
          paid_amount: 9999, // wrong amount
        },
      }),
    );

    expect(res.status).toBe(400);
    expect(mockDb.ecommerceOrder.update).not.toHaveBeenCalled();
  });

  it("returns 400 when invoice id does not match stored xenditPaymentId", async () => {
    mockDb.ecommerceOrder.findUnique.mockResolvedValue({
      id: ORDER_ID,
      totalAmount: 1500,
      paymentStatus: "pending",
      xenditPaymentId: "different-invoice-id",
    });

    const res = await POST(
      makeReq({
        token: VALID_TOKEN,
        body: {
          id: INVOICE_ID,
          external_id: ORDER_ID,
          status: "PAID",
          paid_amount: 1500,
        },
      }),
    );

    expect(res.status).toBe(400);
    expect(mockDb.ecommerceOrder.update).not.toHaveBeenCalled();
  });

  it("maps EXPIRED to paymentStatus=failed", async () => {
    mockDb.ecommerceOrder.findUnique.mockResolvedValue({
      id: ORDER_ID,
      totalAmount: 1500,
      paymentStatus: "pending",
      xenditPaymentId: INVOICE_ID,
    });
    mockDb.ecommerceOrder.update.mockResolvedValue({});

    const res = await POST(
      makeReq({
        token: VALID_TOKEN,
        body: {
          id: INVOICE_ID,
          external_id: ORDER_ID,
          status: "EXPIRED",
        },
      }),
    );

    expect(res.status).toBe(200);
    const updateCall = mockDb.ecommerceOrder.update.mock.calls[0][0];
    expect(updateCall.data.paymentStatus).toBe("failed");
  });
});
