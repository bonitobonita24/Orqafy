// Mobile JWT issuance/verification/revocation — apps/mobile/src/lib/auth.ts
// expects a bearer ACCESS token + a rotating REFRESH token from
// /api/auth/mobile/login (see AuthSession there).
//
// Deliberately signed with a DEDICATED secret (MOBILE_JWT_SECRET), never
// AUTH_SECRET — the web session is a NextAuth-encrypted cookie JWT with its
// own encryption/rotation contract; mixing the two secrets would let a
// mobile-scoped token be replayed against (or forged for) the web session
// path, and vice versa. See env.ts for the required-env wiring.
//
// Revocation store: Valkey/Redis (ioredis, same infra the worker/D7
// notifications transport already uses — REDIS_URL is always provisioned).
// A Prisma table was the other option; Redis was chosen because refresh
// tokens are inherently TTL'd, so an allowlist-with-expiry needs zero cleanup
// job (a DB table would need a cron to prune expired rows). Unlike the
// fail-soft D7 notifications transport, this store is FAIL-CLOSED: if Redis
// is unreachable, refresh/logout must not silently succeed against a control
// we can no longer verify or clear.
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { randomUUID } from "node:crypto";
import Redis from "ioredis";
import { env } from "@/env";

const ACCESS_TOKEN_TTL_SECONDS = 30 * 60; // 30 minutes
const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
const ISSUER = "orqafy-mobile";
const AUDIENCE = "orqafy-mobile-app";

export interface MobileTokenClaims {
  userId: string;
  tenantId: string;
  tenantSlug: string;
  roles: string[];
  securityVersion: number;
}

export interface MobileTokenPair {
  accessToken: string;
  refreshToken: string;
}

function secretKey(): Uint8Array {
  return new TextEncoder().encode(env.MOBILE_JWT_SECRET);
}

// Lazy ioredis singleton, stashed on globalThis to survive Next.js dev
// hot-reload without leaking connections (same pattern as
// server/notifications/valkey.ts and server/jobs/connection.ts).
const globalForMobileAuth = globalThis as unknown as {
  mobileAuthRedis: Redis | undefined;
};

function redisClient(): Redis {
  if (globalForMobileAuth.mobileAuthRedis === undefined) {
    globalForMobileAuth.mobileAuthRedis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
    });
    globalForMobileAuth.mobileAuthRedis.on("error", () => {
      // Swallow — callers surface a real failure via the operation itself
      // (fail-closed: a failed GET/SET/DEL below throws or returns falsy).
    });
  }
  return globalForMobileAuth.mobileAuthRedis;
}

function refreshKey(jti: string): string {
  return `mobile:refresh:${jti}`;
}

async function mintAccessToken(claims: MobileTokenClaims): Promise<string> {
  return new SignJWT({
    userId: claims.userId,
    tenantId: claims.tenantId,
    tenantSlug: claims.tenantSlug,
    roles: claims.roles,
    securityVersion: claims.securityVersion,
    type: "access",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(secretKey());
}

async function mintRefreshToken(
  claims: Pick<MobileTokenClaims, "userId" | "tenantId" | "tenantSlug" | "securityVersion">,
  jti: string,
): Promise<string> {
  return new SignJWT({
    userId: claims.userId,
    tenantId: claims.tenantId,
    tenantSlug: claims.tenantSlug,
    // Captured at mint time so the refresh endpoint can detect a role/
    // tenant/password change (securityVersion bump) since this refresh
    // token was issued — same staleness contract as the web session()
    // callback's token.securityVersion vs dbUser.securityVersion check.
    securityVersion: claims.securityVersion,
    type: "refresh",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setJti(jti)
    .setExpirationTime(`${REFRESH_TOKEN_TTL_SECONDS}s`)
    .sign(secretKey());
}

/**
 * Issues a fresh access+refresh pair and records the refresh token's jti in
 * the Redis allowlist (TTL matches the token's own expiry).
 */
export async function issueTokenPair(claims: MobileTokenClaims): Promise<MobileTokenPair> {
  const jti = randomUUID();
  const [accessToken, refreshToken] = await Promise.all([
    mintAccessToken(claims),
    mintRefreshToken(claims, jti),
  ]);
  await redisClient().set(refreshKey(jti), claims.userId, "EX", REFRESH_TOKEN_TTL_SECONDS);
  return { accessToken, refreshToken };
}

export interface AccessTokenPayload extends JWTPayload {
  userId: string;
  tenantId: string;
  tenantSlug: string;
  roles: string[];
  securityVersion: number;
  type: "access";
}

/**
 * Verifies signature, expiry, issuer/audience, and the "access" token type.
 * Throws on any failure — callers map to a generic 401.
 */
export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, secretKey(), {
    issuer: ISSUER,
    audience: AUDIENCE,
  });
  if (payload["type"] !== "access") {
    throw new Error("Not an access token");
  }
  return payload as AccessTokenPayload;
}

export interface RefreshTokenPayload extends JWTPayload {
  userId: string;
  tenantId: string;
  tenantSlug: string;
  securityVersion: number;
  type: "refresh";
  jti: string;
}

/**
 * Verifies signature/expiry/issuer/audience/type AND that the jti is still
 * present in the Redis allowlist (i.e. not yet rotated or revoked). Throws
 * on any failure — including a Redis error (fail-closed).
 */
export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
  const { payload } = await jwtVerify(token, secretKey(), {
    issuer: ISSUER,
    audience: AUDIENCE,
  });
  if (payload["type"] !== "refresh" || typeof payload.jti !== "string") {
    throw new Error("Not a refresh token");
  }
  const stillValid = await redisClient().get(refreshKey(payload.jti));
  if (stillValid === null) {
    throw new Error("Refresh token revoked or expired");
  }
  return payload as RefreshTokenPayload;
}

/** Removes a refresh token's jti from the allowlist (rotation or logout). */
export async function revokeRefreshToken(jti: string): Promise<void> {
  await redisClient().del(refreshKey(jti));
}
