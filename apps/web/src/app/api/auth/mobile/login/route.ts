// Non-tRPC: manual auth required (security.md L11) — this IS the auth entry
// point for apps/mobile (see src/hooks/use-auth.ts login()). tRPC/NextAuth
// session cookies are browser-only; mobile needs a portable bearer token.
//
// Body: { email, password } — NO tenantSlug. apps/mobile's useAuth().login()
// (already built, not editable in this change) only collects email+password.
// This is safe because User.email carries a GLOBAL @unique constraint in the
// schema — see verifyCredentialsByEmail in server/auth/verify-credentials.ts
// for the full rationale.
import { type NextRequest, NextResponse } from "next/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { rateLimiters } from "@/server/lib/rate-limit";
import { verifyCredentialsByEmail } from "@/server/auth/verify-credentials";
import { issueTokenPair } from "@/server/auth/mobile-jwt";

// Node runtime required: bcrypt (via verifyCredentialsByEmail) is not
// supported on the Edge runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const mobileLoginSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(1),
  })
  .strict();

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    rateLimiters.auth.check(clientIp(req));
  } catch (e) {
    if (e instanceof TRPCError && e.code === "TOO_MANY_REQUESTS") {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    throw e;
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = mobileLoginSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 400 });
  }

  const user = await verifyCredentialsByEmail(parsed.data);
  if (user === null) {
    // Generic message — never reveal whether the email/password/tenant was
    // wrong (security.md: auth errors must not enable enumeration).
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const { accessToken, refreshToken } = await issueTokenPair({
    userId: user.id,
    tenantId: user.tenantId,
    tenantSlug: user.tenantSlug,
    roles: user.roles,
    securityVersion: user.securityVersion,
  });

  // Shape MUST match apps/mobile/src/lib/auth.ts `AuthSession`.
  return NextResponse.json({
    token: accessToken,
    refreshToken,
    tenantId: user.tenantId,
    userId: user.id,
    roles: user.roles,
  });
}
