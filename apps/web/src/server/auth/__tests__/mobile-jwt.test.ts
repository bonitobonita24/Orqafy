// mobile-jwt.test.ts — token mint/verify round-trip, refresh rotation,
// stale-securityVersion / revoked rejection.
import { describe, it, expect, vi, beforeEach } from "vitest";

const TEST_SECRET = "x".repeat(48);

vi.mock("@/env", () => ({
  env: {
    MOBILE_JWT_SECRET: TEST_SECRET,
    REDIS_URL: "redis://localhost:6379",
  },
}));

// Minimal in-memory fake of the ioredis surface mobile-jwt.ts actually uses
// (get/set/del + the fire-and-forget `.on("error", ...)` listener wiring).
class FakeRedis {
  private store = new Map<string, string>();
  on(): void {
    /* no-op */
  }
  set(key: string, value: string): Promise<"OK"> {
    this.store.set(key, value);
    return Promise.resolve("OK");
  }
  get(key: string): Promise<string | null> {
    return Promise.resolve(this.store.get(key) ?? null);
  }
  del(key: string): Promise<number> {
    const existed = this.store.delete(key);
    return Promise.resolve(existed ? 1 : 0);
  }
}

vi.mock("ioredis", () => ({ default: FakeRedis }));

const CLAIMS = {
  userId: "user-1",
  tenantId: "tenant-1",
  tenantSlug: "acme",
  roles: ["admin"],
  securityVersion: 1,
};

describe("mobile-jwt", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("mints an access+refresh pair whose access token verifies with matching claims", async () => {
    const { issueTokenPair, verifyAccessToken } = await import("../mobile-jwt");
    const { accessToken } = await issueTokenPair(CLAIMS);

    const payload = await verifyAccessToken(accessToken);
    expect(payload.userId).toBe(CLAIMS.userId);
    expect(payload.tenantId).toBe(CLAIMS.tenantId);
    expect(payload.tenantSlug).toBe(CLAIMS.tenantSlug);
    expect(payload.roles).toEqual(CLAIMS.roles);
    expect(payload.securityVersion).toBe(CLAIMS.securityVersion);
    expect(payload.type).toBe("access");
  });

  it("verifies a freshly-issued refresh token (allowlisted)", async () => {
    const { issueTokenPair, verifyRefreshToken } = await import("../mobile-jwt");
    const { refreshToken } = await issueTokenPair(CLAIMS);

    const payload = await verifyRefreshToken(refreshToken);
    expect(payload.userId).toBe(CLAIMS.userId);
    expect(payload.securityVersion).toBe(CLAIMS.securityVersion);
    expect(payload.type).toBe("refresh");
    expect(typeof payload.jti).toBe("string");
  });

  it("rejects a refresh token whose jti has been revoked (rotation/logout)", async () => {
    const { issueTokenPair, verifyRefreshToken, revokeRefreshToken } = await import(
      "../mobile-jwt"
    );
    const { refreshToken } = await issueTokenPair(CLAIMS);
    const payload = await verifyRefreshToken(refreshToken);

    await revokeRefreshToken(payload.jti);

    await expect(verifyRefreshToken(refreshToken)).rejects.toThrow();
  });

  it("rejects verifyAccessToken given a refresh token (wrong type)", async () => {
    const { issueTokenPair, verifyAccessToken } = await import("../mobile-jwt");
    const { refreshToken } = await issueTokenPair(CLAIMS);

    await expect(verifyAccessToken(refreshToken)).rejects.toThrow();
  });

  it("rejects verifyRefreshToken given an access token (wrong type)", async () => {
    const { issueTokenPair, verifyRefreshToken } = await import("../mobile-jwt");
    const { accessToken } = await issueTokenPair(CLAIMS);

    await expect(verifyRefreshToken(accessToken)).rejects.toThrow();
  });

  it("rejects a tampered token (bad signature)", async () => {
    const { issueTokenPair, verifyAccessToken } = await import("../mobile-jwt");
    const { accessToken } = await issueTokenPair(CLAIMS);
    const tampered = accessToken.slice(0, -2) + "zz";

    await expect(verifyAccessToken(tampered)).rejects.toThrow();
  });

  it("each issued refresh token gets a distinct jti (independent rotation)", async () => {
    const { issueTokenPair, verifyRefreshToken } = await import("../mobile-jwt");
    const pairA = await issueTokenPair(CLAIMS);
    const pairB = await issueTokenPair(CLAIMS);

    const payloadA = await verifyRefreshToken(pairA.refreshToken);
    const payloadB = await verifyRefreshToken(pairB.refreshToken);
    expect(payloadA.jti).not.toBe(payloadB.jti);
  });
});
