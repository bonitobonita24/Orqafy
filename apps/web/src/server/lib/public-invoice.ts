// Shared sanitized public-invoice lookup — single source of truth for the
// customer-facing invoice payload shape.
//
// Security contract (mirrors the /api/invoice/[publicToken] route):
//  1. Token is the sole authorisation — no session required.
//  2. tenantId is derived from the invoice row (never trusted from inbound hints).
//  3. Only customer-facing fields are returned — no internal costs, audit
//     fields, or PII beyond what a customer needs.
//  4. Callers MUST treat `null` as "not found" (404 / notFound()) — never
//     leak whether a malformed token differs from an unknown token.
import { prisma } from "@orqafy/db";

export async function getPublicInvoiceByToken(publicToken: string) {
  // Minimal length guard — a cuid is 25 chars; reject obviously malformed
  // tokens early, without touching the DB.
  if (!publicToken || publicToken.length < 8) {
    return null;
  }

  const invoice = await prisma.invoice.findUnique({
    where: { publicToken },
    select: {
      id: true,
      invoiceNumber: true,
      status: true,
      dueDate: true,
      issuedAt: true,
      paidAt: true,
      totalAmount: true,
      currency: true,
      notes: true,
      lineItems: true,
      createdAt: true,
      customer: {
        select: {
          firstName: true,
          lastName: true,
          companyName: true,
          email: true,
        },
      },
      project: { select: { name: true } },
      tenant: { select: { name: true, logoUrl: true, currency: true } },
    },
  });

  if (!invoice) {
    return null;
  }

  // Explicit re-pick, not just the Prisma `select` above. `select` is the
  // real access-control boundary against Postgres — but it can't protect
  // against a caller/mock/future refactor that swaps the query for one
  // returning a wider row (e.g. `include`/`findFirst`). Re-picking here is
  // the belt-and-braces guarantee that internal/audit fields (tenantId,
  // createdById, quotationId, amountPaid, balance, signatureUrl, signerIp,
  // signerName, metadata, termsAndConditions, updatedAt, publicToken) can
  // never leak through this function under any circumstance.
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    dueDate: invoice.dueDate,
    issuedAt: invoice.issuedAt,
    paidAt: invoice.paidAt,
    totalAmount: invoice.totalAmount,
    currency: invoice.currency,
    notes: invoice.notes,
    lineItems: invoice.lineItems,
    createdAt: invoice.createdAt,
    customer: invoice.customer,
    project: invoice.project,
    tenant: invoice.tenant,
  };
}

export type PublicInvoice = NonNullable<
  Awaited<ReturnType<typeof getPublicInvoiceByToken>>
>;
