// Shared bearer-token extraction + verification for mobile-only Route
// Handlers (logout, push-token). Non-tRPC endpoints must do this manually —
// see security.md L11 ("// Non-tRPC: manual auth required").
import { type NextRequest } from "next/server";
import { verifyAccessToken, type AccessTokenPayload } from "@/server/auth/mobile-jwt";

/** Returns the verified access-token payload, or null if missing/invalid/expired. */
export async function requireMobileBearer(req: NextRequest): Promise<AccessTokenPayload | null> {
  const header = req.headers.get("authorization");
  if (header === null || !header.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  if (token === "") return null;
  try {
    return await verifyAccessToken(token);
  } catch {
    return null;
  }
}
