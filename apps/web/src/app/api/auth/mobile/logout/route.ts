// Non-tRPC: manual auth required (security.md L11).
// Bearer-protected. Body: { refreshToken } — revokes it so it can never be
// used to mint another access token, even though the (short-lived, 30 min)
// access token presented in the Authorization header remains valid until it
// naturally expires. apps/mobile clears its local SecureStore regardless of
// this call's outcome (see src/hooks/use-auth.ts logout() — best-effort).
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireMobileBearer } from "@/server/auth/mobile-bearer";
import { revokeRefreshToken, verifyRefreshToken } from "@/server/auth/mobile-jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const logoutSchema = z.object({ refreshToken: z.string().min(1) }).strict();

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

  const parsed = logoutSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Best-effort: an already-expired/invalid refresh token still counts as
  // "logged out" from the client's perspective — only revoke if it's a
  // genuine, still-live refresh token for THIS user.
  try {
    const payload = await verifyRefreshToken(parsed.data.refreshToken);
    if (payload.userId === claims.userId) {
      await revokeRefreshToken(payload.jti);
    }
  } catch {
    // Already invalid/expired/revoked — nothing to do.
  }

  return NextResponse.json({ ok: true });
}
