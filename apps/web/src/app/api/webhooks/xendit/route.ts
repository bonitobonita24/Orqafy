// Non-tRPC: webhook endpoint — x-callback-token IS the auth, no session middleware.
// Xendit cannot provide JWT — signature verification via x-callback-token header.
//
// Batch 21c (Direction F complete): per-tenant resolution.
// The webhook token lives in TenantXenditConfig.webhookTokenEnc per tenant, so
// we must resolve the order's tenant BEFORE we can verify the signature.
// Order resolution comes from EcommerceOrder.id (= Xendit external_id) which now
// carries a tenantId column. Flow:
//   1. Reject early if x-callback-token header is missing (cheap, no DB).
//   2. Parse JSON body; reject 400 on parse failure or missing required fields.
//   3. Look up the order by external_id. If null → 401 (NOT 200, NOT 404) so
//      attackers cannot enumerate valid order ids via status-code differences.
//   4. Look up the order's TenantXenditConfig. Missing or unverified → 401.
//   5. Decrypt webhookTokenEnc and timingSafeEqual against the presented token.
//      Mismatch → 401.
//   6. Verify invoice id match, amount, idempotency; update payment status.
import { timingSafeEqual } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { prisma as db } from "@orqafy/db";
import { decrypt } from "@/lib/crypto";

const XENDIT_STATUS_TO_PAYMENT_STATUS: Record<string, string | undefined> = {
  PAID: "paid",
  SETTLED: "paid",
  EXPIRED: "failed",
  FAILED: "failed",
};

const TERMINAL_PAYMENT_STATUSES = new Set(["paid", "failed", "refunded"]);

const unauthorized = (): NextResponse =>
  NextResponse.json({ error: "Unauthorized" }, { status: 401 });

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Early reject when no header present — no DB touch.
  const callbackToken = req.headers.get("x-callback-token");
  if (callbackToken === null || callbackToken === "") {
    return unauthorized();
  }

  // 2. Parse JSON body.
  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const externalId = payload["external_id"] as string | undefined;
  const status = payload["status"] as string | undefined;
  const invoiceId = payload["id"] as string | undefined;
  const paidAmount = payload["paid_amount"] as number | undefined;

  if (
    externalId === undefined ||
    externalId === "" ||
    status === undefined ||
    status === "" ||
    invoiceId === undefined ||
    invoiceId === ""
  ) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }

  // 3. Resolve order. Null → 401 (enumeration prevention).
  const order = await db.ecommerceOrder.findUnique({
    where: { id: externalId },
    select: {
      id: true,
      tenantId: true,
      totalAmount: true,
      paymentStatus: true,
      xenditPaymentId: true,
    },
  });
  if (order === null) {
    return unauthorized();
  }

  // 4. Resolve tenant's Xendit config. Missing or unverified → 401.
  const config = await db.tenantXenditConfig.findUnique({
    where: { tenantId: order.tenantId },
  });
  if (config === null || !config.isVerified) {
    return unauthorized();
  }

  // 5. Constant-time token comparison against decrypted per-tenant value.
  const expectedTokenPlain = decrypt(config.webhookTokenEnc);
  const expected = Buffer.from(expectedTokenPlain, "utf8");
  const received = Buffer.from(callbackToken, "utf8");
  const tokensMatch =
    expected.length > 0 &&
    expected.length === received.length &&
    timingSafeEqual(expected, received);
  if (!tokensMatch) {
    return unauthorized();
  }

  // 6. Replay guard: stored invoice id must match the webhook's invoice id.
  if (order.xenditPaymentId !== invoiceId) {
    return NextResponse.json(
      { error: "Invoice id mismatch" },
      { status: 400 },
    );
  }

  const nextPaymentStatus = XENDIT_STATUS_TO_PAYMENT_STATUS[status];
  // Unknown Xendit event — acknowledge, skip DB update.
  if (nextPaymentStatus === undefined) {
    return NextResponse.json({ received: true });
  }

  // Idempotency: already terminal — no-op, return 200.
  if (TERMINAL_PAYMENT_STATUSES.has(order.paymentStatus)) {
    return NextResponse.json({ received: true });
  }

  // Defence-in-depth: verify amount matches our recorded total for PAID events.
  if (nextPaymentStatus === "paid" && paidAmount !== undefined) {
    if (Number(order.totalAmount) !== paidAmount) {
      return NextResponse.json(
        { error: "Amount mismatch" },
        { status: 400 },
      );
    }
  }

  await db.ecommerceOrder.update({
    where: { id: order.id },
    data: { paymentStatus: nextPaymentStatus },
  });

  return NextResponse.json({ received: true });
}
