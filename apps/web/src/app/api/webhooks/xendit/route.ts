// Non-tRPC: webhook endpoint — x-callback-token IS the auth, no session middleware.
// Xendit cannot provide JWT — signature verification via x-callback-token header.
import { timingSafeEqual } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { env } from "@/env";
import { prisma as db } from "@orqafy/db";

const XENDIT_STATUS_TO_PAYMENT_STATUS: Record<string, string | undefined> = {
  PAID: "paid",
  SETTLED: "paid",
  EXPIRED: "failed",
  FAILED: "failed",
};

const TERMINAL_PAYMENT_STATUSES = new Set(["paid", "failed", "refunded"]);

export async function POST(req: NextRequest): Promise<NextResponse> {
  const callbackToken = req.headers.get("x-callback-token") ?? "";

  // Constant-time comparison — prevents timing attacks.
  const expected = Buffer.from(env.XENDIT_WEBHOOK_TOKEN ?? "", "utf8");
  const received = Buffer.from(callbackToken, "utf8");
  const tokensMatch =
    expected.length > 0 &&
    expected.length === received.length &&
    timingSafeEqual(expected, received);

  if (!tokensMatch) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  const order = await db.ecommerceOrder.findUnique({
    where: { id: externalId },
    select: {
      id: true,
      totalAmount: true,
      paymentStatus: true,
      xenditPaymentId: true,
    },
  });

  // Unknown order — return 200 to silence Xendit retries (idempotency contract).
  if (order === null) {
    return NextResponse.json({ received: true });
  }

  // Stored invoice id must match webhook's invoice id — prevents replay across orders.
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
