/**
 * /invoice/[token] — public invoice view page.
 *
 * Proves:
 *  1. found token → renders invoice number + formatted total (via the
 *     rendered React element tree — no DOM/jsdom needed, this repo's
 *     vitest environment is "node").
 *  2. not-found token → calls next/navigation notFound().
 *  3. generateMetadata() returns robots noindex,nofollow (PII behind an
 *     unguessable token must never be indexed).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetPublicInvoiceByToken, mockNotFound } = vi.hoisted(() => ({
  mockGetPublicInvoiceByToken: vi.fn(),
  mockNotFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("@/server/lib/public-invoice", () => ({
  getPublicInvoiceByToken: mockGetPublicInvoiceByToken,
}));

vi.mock("next/navigation", () => ({
  notFound: mockNotFound,
}));

import PublicInvoicePage, { generateMetadata } from "../[token]/page";

type ReactNodeLike =
  | string
  | number
  | boolean
  | null
  | undefined
  | ReactNodeLike[]
  | { props?: { children?: ReactNodeLike } };

// Walk the rendered React element tree and collect all string/number leaves.
// This works without a DOM: JSX compiles to plain { type, props } objects.
function collectText(node: ReactNodeLike, acc: string[] = []): string[] {
  if (node === null || node === undefined || typeof node === "boolean") {
    return acc;
  }
  if (typeof node === "string" || typeof node === "number") {
    acc.push(String(node));
    return acc;
  }
  if (Array.isArray(node)) {
    for (const child of node) collectText(child, acc);
    return acc;
  }
  if (typeof node === "object" && "props" in node) {
    collectText(node.props?.children, acc);
  }
  return acc;
}

function buildFoundInvoice() {
  return {
    id: "inv-1",
    invoiceNumber: "INV-2026-042",
    status: "sent",
    dueDate: new Date("2026-09-30"),
    issuedAt: new Date("2026-08-27"),
    paidAt: null,
    totalAmount: 12345.67,
    currency: "PHP",
    notes: "Thank you for your business.",
    lineItems: [{ description: "Consulting", quantity: 1, unitPrice: 12345.67 }],
    createdAt: new Date("2026-08-27"),
    customer: {
      firstName: "Maria",
      lastName: "Santos",
      companyName: null,
      email: "maria@santos.com",
    },
    project: { name: "Website Redesign" },
    tenant: { name: "Powerbyte IT Solutions", logoUrl: null, currency: "PHP" },
  };
}

describe("PublicInvoicePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("found token → renders invoice number + formatted total", async () => {
    mockGetPublicInvoiceByToken.mockResolvedValueOnce(buildFoundInvoice());

    const element = await PublicInvoicePage({
      params: Promise.resolve({ token: "clpublictoken0000000000001" }),
    });

    const text = collectText(element).join(" ");
    expect(text).toContain("INV-2026-042");
    expect(text).toContain("Maria Santos");
    expect(text).toContain("Powerbyte IT Solutions");
    expect(text).toContain("Website Redesign");
    // en-PH currency formatting of 12345.67 PHP.
    expect(text).toMatch(/12,345\.67/);
  });

  it("not-found token → calls notFound()", async () => {
    mockGetPublicInvoiceByToken.mockResolvedValueOnce(null);

    await expect(
      PublicInvoicePage({ params: Promise.resolve({ token: "unknown-token-xyz" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(mockNotFound).toHaveBeenCalledOnce();
  });

  it("generateMetadata() sets robots noindex,nofollow", async () => {
    const metadata = await generateMetadata();
    expect(metadata.robots).toStrictEqual({ index: false, follow: false });
  });
});
