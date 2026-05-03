// Non-tRPC: webhook endpoint — x-callback-token IS the auth, no session middleware.
// Xendit cannot provide JWT — signature verification via x-callback-token header.
import { timingSafeEqual } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { env } from "@/env";

export async function POST(req: NextRequest) {
  const callbackToken = req.headers.get("x-callback-token") ?? "";

  // Constant-time comparison — prevents timing attacks
  const expected = Buffer.from(env.XENDIT_WEBHOOK_TOKEN ?? "", "utf8");
  const received = Buffer.from(callbackToken, "utf8");
  const tokensMatch =
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

  // Validate required fields exist
  const externalId = payload["external_id"] as string | undefined;
  const status = payload["status"] as string | undefined;
  const paidAmount = payload["paid_amount"] as number | undefined;

  if (externalId === undefined || externalId === "" || status === undefined || status === "") {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Idempotency: check if this transaction was already processed.
  // Real implementation queries DB for existing processed record.
  // Xendit retries up to 6 times — duplicate webhook must return 200 without re-processing.
  // TODO(Phase 8): implement idempotency check via DB unique constraint on externalId

  // Enqueue for async processing — prevents timeout on slow DB writes.
  // Worker validates tenantId and processes the payment update.
  // TODO(Phase 8): enqueue to BullMQ payment queue when packages/jobs is wired
  void { externalId, status, paidAmount };

  return NextResponse.json({ received: true });
}
