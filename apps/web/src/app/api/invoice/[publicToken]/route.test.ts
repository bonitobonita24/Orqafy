/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
/**
 * Public invoice view REST endpoint — GET /api/invoice/[publicToken]
 *
 * Proves:
 *  1. valid token → 200 with sanitised payload (customer-facing fields only)
 *  2. unknown token → 404 (not 401 — prevents enumeration)
 *  3. malformed / too-short token → 404
 *  4. rate-limit breach → 429
 *  5. tenant isolation — no internal fields leak (tenantId, createdById, signerIp, balance, etc.)
 *  6. no cross-tenant data — payload contains only the row resolved by token, tenant derived from row
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ────────────────────────────────────────────────────────────
const { mockInvoiceFindUnique, mockRateLimitCheck, mockLoggerInfo } =
  vi.hoisted(() => ({
    mockInvoiceFindUnique: vi.fn(),
    mockRateLimitCheck: vi.fn(),
    mockLoggerInfo: vi.fn(),
  }));

vi.mock("@orqafy/db", () => ({
  prisma: {
    invoice: { findUnique: mockInvoiceFindUnique },
  },
}));

vi.mock("@/server/lib/rate-limit", () => ({
  rateLimiters: {
    public_invoice: { check: mockRateLimitCheck },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: mockLoggerInfo, warn: vi.fn(), error: vi.fn() },
}));

// ── Import under test (after mocks) ─────────────────────────────────────────
import { GET } from "./route";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(token: string): Request {
  const url = `http://localhost/api/invoice/${token}`;
  return new Request(url, {
    method: "GET",
    headers: { "x-forwarded-for": "1.2.3.4" },
  });
}

function makeParams(token: string): { params: Promise<{ publicToken: string }> } {
  return { params: Promise.resolve({ publicToken: token }) };
}

const VALID_TOKEN = "clpublictoken0000000000001";

/** Full invoice DB row returned by findUnique(include: customer, project, tenant) */
function buildInvoiceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "clinvoicexxxxxxxxxx0001",
    invoiceNumber: "INV-2026-001",
    status: "sent",
    dueDate: new Date("2026-07-31"),
    issuedAt: new Date("2026-06-24"),
    paidAt: null,
    totalAmount: { toJSON: () => "5000.00", toString: () => "5000.00" },
    currency: "PHP",
    notes: "Thank you for your business.",
    lineItems: [{ description: "Consulting", quantity: 1, unitPrice: 5000 }],
    // Internal fields — must NOT appear in sanitised payload
    tenantId: "tenant-A",
    createdById: "user-internal-id",
    amountPaid: { toString: () => "0" },
    balance: { toString: () => "5000.00" },
    signatureUrl: null,
    signerIp: "192.168.1.1",
    signerName: null,
    metadata: { internalNote: "secret" },
    termsAndConditions: "internal terms",
    publicToken: VALID_TOKEN,
    createdAt: new Date("2026-06-24"),
    updatedAt: new Date("2026-06-24"),
    // Relations
    customer: {
      firstName: "Maria",
      lastName: "Santos",
      companyName: "Santos Enterprises",
      email: "maria@santos.com",
    },
    project: { name: "Website Redesign" },
    tenant: {
      name: "Powerbyte IT Solutions",
      logoUrl: "https://cdn.example.com/logo.png",
      currency: "PHP",
    },
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("GET /api/invoice/[publicToken]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimitCheck.mockReturnValue(undefined); // pass by default
  });

  it("valid token → 200 with sanitised customer-facing payload", async () => {
    mockInvoiceFindUnique.mockResolvedValueOnce(buildInvoiceRow());

    const res = await GET(makeRequest(VALID_TOKEN) as any, makeParams(VALID_TOKEN));
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(body.invoiceNumber).toBe("INV-2026-001");
    expect(body.status).toBe("sent");
    expect(body.currency).toBe("PHP");
    expect(body.customer).toMatchObject({ firstName: "Maria", lastName: "Santos" });
    expect(body.project).toMatchObject({ name: "Website Redesign" });
    expect(body.tenant).toMatchObject({ name: "Powerbyte IT Solutions" });
    expect(body.lineItems).toBeDefined();
  });

  it("does NOT leak internal fields (tenantId, createdById, amountPaid, balance, signerIp, metadata, etc.)", async () => {
    mockInvoiceFindUnique.mockResolvedValueOnce(buildInvoiceRow());

    const res = await GET(makeRequest(VALID_TOKEN) as any, makeParams(VALID_TOKEN));
    const body = (await res.json()) as Record<string, unknown>;

    // These fields must be absent from the public payload.
    expect(body).not.toHaveProperty("tenantId");
    expect(body).not.toHaveProperty("createdById");
    expect(body).not.toHaveProperty("amountPaid");
    expect(body).not.toHaveProperty("balance");
    expect(body).not.toHaveProperty("signerIp");
    expect(body).not.toHaveProperty("signerName");
    expect(body).not.toHaveProperty("metadata");
    expect(body).not.toHaveProperty("termsAndConditions");
    expect(body).not.toHaveProperty("updatedAt");
    expect(body).not.toHaveProperty("publicToken");
  });

  it("unknown token → 404, not 401 (prevents status-code enumeration)", async () => {
    mockInvoiceFindUnique.mockResolvedValueOnce(null);

    const res = await GET(
      makeRequest("clunknowntoken0000000001") as any,
      makeParams("clunknowntoken0000000001"),
    );
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(404);
    expect(body.error).toMatch(/not found/i);
  });

  it("malformed token (too short) → 404 without touching DB", async () => {
    const res = await GET(
      makeRequest("short") as any,
      makeParams("short"),
    );

    expect(res.status).toBe(404);
    // DB must not be called for obviously invalid tokens.
    expect(mockInvoiceFindUnique).not.toHaveBeenCalled();
  });

  it("rate-limit breach → 429", async () => {
    const { TRPCError } = await import("@trpc/server");
    mockRateLimitCheck.mockImplementationOnce(() => {
      throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Rate limit exceeded." });
    });

    const res = await GET(makeRequest(VALID_TOKEN) as any, makeParams(VALID_TOKEN));
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(429);
    expect(body.error).toMatch(/too many/i);
    // DB must not be called when rate-limited.
    expect(mockInvoiceFindUnique).not.toHaveBeenCalled();
  });

  it("DB lookup uses publicToken field — not id — so tenant is always derived from the row", async () => {
    mockInvoiceFindUnique.mockResolvedValueOnce(buildInvoiceRow());

    await GET(makeRequest(VALID_TOKEN) as any, makeParams(VALID_TOKEN));

    expect(mockInvoiceFindUnique).toHaveBeenCalledOnce();
    const call = mockInvoiceFindUnique.mock.calls[0]![0] as { where: Record<string, unknown> };
    // Lookup must be by publicToken only — no tenant hint from the request.
    expect(call.where).toStrictEqual({ publicToken: VALID_TOKEN });
    expect(call.where).not.toHaveProperty("tenantId");
  });
});
