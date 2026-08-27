/**
 * getPublicInvoiceByToken — shared sanitized public-invoice lookup.
 *
 * Proves:
 *  1. malformed / too-short token → null, no DB hit
 *  2. unknown token → null (DB returns null)
 *  3. valid token → row shaped with exactly the customer-facing select set
 *  4. the Prisma call is scoped by publicToken only (tenant derived from row)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockInvoiceFindUnique } = vi.hoisted(() => ({
  mockInvoiceFindUnique: vi.fn(),
}));

vi.mock("@orqafy/db", () => ({
  prisma: {
    invoice: { findUnique: mockInvoiceFindUnique },
  },
}));

import { getPublicInvoiceByToken } from "../public-invoice";

const VALID_TOKEN = "clpublictoken0000000000001";

describe("getPublicInvoiceByToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("malformed / too-short token → null, no DB hit", async () => {
    const result = await getPublicInvoiceByToken("short");
    expect(result).toBeNull();
    expect(mockInvoiceFindUnique).not.toHaveBeenCalled();
  });

  it("empty token → null, no DB hit", async () => {
    const result = await getPublicInvoiceByToken("");
    expect(result).toBeNull();
    expect(mockInvoiceFindUnique).not.toHaveBeenCalled();
  });

  it("unknown token → null (DB miss)", async () => {
    mockInvoiceFindUnique.mockResolvedValueOnce(null);
    const result = await getPublicInvoiceByToken(VALID_TOKEN);
    expect(result).toBeNull();
  });

  it("valid token → resolves the row via a select scoped to publicToken only", async () => {
    mockInvoiceFindUnique.mockResolvedValueOnce({ id: "inv-1", invoiceNumber: "INV-1" });

    await getPublicInvoiceByToken(VALID_TOKEN);

    expect(mockInvoiceFindUnique).toHaveBeenCalledOnce();
    const call = mockInvoiceFindUnique.mock.calls[0]![0] as {
      where: Record<string, unknown>;
      select: Record<string, unknown>;
    };
    expect(call.where).toStrictEqual({ publicToken: VALID_TOKEN });

    // Sanitized field set — exactly the customer-facing shape, nothing else.
    expect(Object.keys(call.select).sort()).toStrictEqual(
      [
        "id",
        "invoiceNumber",
        "status",
        "dueDate",
        "issuedAt",
        "paidAt",
        "totalAmount",
        "currency",
        "notes",
        "lineItems",
        "createdAt",
        "customer",
        "project",
        "tenant",
      ].sort(),
    );

    // Never select internal/audit fields.
    for (const forbidden of [
      "tenantId",
      "createdById",
      "quotationId",
      "amountPaid",
      "balance",
      "signatureUrl",
      "signerIp",
      "signerName",
      "metadata",
      "termsAndConditions",
      "updatedAt",
      "publicToken",
    ]) {
      expect(call.select).not.toHaveProperty(forbidden);
    }
  });
});
