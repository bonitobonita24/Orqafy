// Non-tRPC: public invoice view — no auth, no session, no tenant middleware.
// The publicToken is a unique opaque token stored on the Invoice row.
// Token presence implies tenant — derived from the invoice row, never from a header.
//
// Security contract:
//  1. Token is the sole authorisation — no session required.
//  2. tenantId is derived from the invoice row (never trusted from inbound hints).
//  3. Only customer-facing fields are returned — no internal costs, audit fields, or PII beyond what a customer needs.
//  4. Unknown / invalid token → 404 (not 401 — prevents enumeration via status-code differences).
//  5. Rate-limited at 30 req/min per IP via the existing public_invoice tier.
import { type NextRequest, NextResponse } from "next/server";
import { rateLimiters } from "@/server/lib/rate-limit";
import { logger } from "@/lib/logger";
import { getPublicInvoiceByToken } from "@/server/lib/public-invoice";

function notFound() {
  return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ publicToken: string }> },
): Promise<NextResponse> {
  // Rate-limit by IP before any DB access.
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  try {
    rateLimiters.public_invoice.check(ip);
  } catch {
    return NextResponse.json(
      { error: "Too many requests. Try again later." },
      { status: 429 },
    );
  }

  const { publicToken } = await params;

  // Minimal length guard — a cuid is 25 chars; reject obviously malformed tokens early.
  if (!publicToken || publicToken.length < 8) {
    return notFound();
  }

  logger.info(
    { surface: "invoice.public-view", tokenPrefix: publicToken.slice(0, 6) },
    "public invoice view requested",
  );

  // Shared sanitised lookup (also used by the /invoice/[token] page) — the
  // single source of truth for which fields are customer-facing.
  // EXCLUDED: tenantId, createdById, quotationId, amountPaid, balance,
  //           signatureUrl, signerIp, signerName, metadata, termsAndConditions (internal),
  //           updatedAt, audit columns, any relation FK strings.
  const invoice = await getPublicInvoiceByToken(publicToken);

  if (!invoice) {
    return notFound();
  }

  return NextResponse.json(invoice, { status: 200 });
}
