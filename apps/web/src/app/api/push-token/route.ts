// Non-tRPC: manual auth required (security.md L11).
// Bearer-protected. Upserts a device push token (Expo Push) for the
// authenticated mobile user by (userId, token) — a device re-registering the
// same token just bumps lastSeenAt; a rotated token creates a new row.
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma as db } from "@orqafy/db";
import { requireMobileBearer } from "@/server/auth/mobile-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pushTokenSchema = z
  .object({
    token: z.string().min(1),
    platform: z.string().min(1),
  })
  .strict();

export async function POST(req: NextRequest): Promise<NextResponse> {
  const claims = await requireMobileBearer(req);
  if (claims === null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = pushTokenSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  await db.devicePushToken.upsert({
    where: { userId_token: { userId: claims.userId, token: parsed.data.token } },
    create: {
      userId: claims.userId,
      tenantId: claims.tenantId,
      token: parsed.data.token,
      platform: parsed.data.platform,
    },
    update: {
      platform: parsed.data.platform,
      lastSeenAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
