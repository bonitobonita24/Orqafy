// Non-tRPC: manual auth required (security.md L11).
// Body: { refreshToken }. Verifies + ROTATES the refresh token (old jti is
// revoked, a new pair is minted) and re-checks the user's current
// securityVersion/isActive — mirrors the same staleness check the web
// session() callback performs on every session fetch (config.ts), so a
// role change / deactivation / password change invalidates outstanding
// mobile sessions within one refresh cycle, not just at web-cookie expiry.
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma as db } from "@orqafy/db";
import {
  verifyRefreshToken,
  revokeRefreshToken,
  issueTokenPair,
} from "@/server/auth/mobile-jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const refreshSchema = z.object({ refreshToken: z.string().min(1) }).strict();

export async function POST(req: NextRequest): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = refreshSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  let payload;
  try {
    payload = await verifyRefreshToken(parsed.data.refreshToken);
  } catch {
    return NextResponse.json({ error: "Invalid or expired refresh token" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      tenantId: true,
      isActive: true,
      securityVersion: true,
      roleId: true,
      role: { select: { name: true } },
      tenant: { select: { slug: true, isActive: true } },
    },
  });

  // Rotate: the presented refresh token is single-use regardless of outcome
  // — revoke it now so a stale/staleness-rejected token can never be reused.
  await revokeRefreshToken(payload.jti);

  if (
    user === null ||
    !user.isActive ||
    user.tenant.isActive !== true ||
    user.tenantId !== payload.tenantId ||
    user.securityVersion !== payload.securityVersion
  ) {
    return NextResponse.json({ error: "Invalid or expired refresh token" }, { status: 401 });
  }

  const { accessToken, refreshToken } = await issueTokenPair({
    userId: user.id,
    tenantId: user.tenantId,
    tenantSlug: user.tenant.slug,
    roles: [user.role.name],
    securityVersion: user.securityVersion,
  });

  return NextResponse.json({ token: accessToken, refreshToken });
}
