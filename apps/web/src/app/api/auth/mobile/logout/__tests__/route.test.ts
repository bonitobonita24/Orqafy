import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockVerifyAccessToken, mockVerifyRefreshToken, mockRevokeRefreshToken } = vi.hoisted(
  () => ({
    mockVerifyAccessToken: vi.fn(),
    mockVerifyRefreshToken: vi.fn(),
    mockRevokeRefreshToken: vi.fn(),
  }),
);

vi.mock("@/server/auth/mobile-jwt", () => ({
  verifyAccessToken: mockVerifyAccessToken,
  verifyRefreshToken: mockVerifyRefreshToken,
  revokeRefreshToken: mockRevokeRefreshToken,
}));

import { POST } from "../route";

function makeRequest(body: unknown, bearer?: string): NextRequest {
  return new NextRequest("http://localhost/api/auth/mobile/logout", {
    method: "POST",
    body: JSON.stringify(body),
    headers: bearer !== undefined ? { Authorization: `Bearer ${bearer}` } : {},
  });
}

const ACCESS_PAYLOAD = {
  userId: "user-1",
  tenantId: "tenant-1",
  tenantSlug: "acme",
  roles: ["admin"],
  securityVersion: 1,
  type: "access" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/auth/mobile/logout", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await POST(makeRequest({ refreshToken: "rt" }));
    expect(res.status).toBe(401);
    expect(mockVerifyAccessToken).not.toHaveBeenCalled();
  });

  it("returns 401 when the bearer access token is invalid", async () => {
    mockVerifyAccessToken.mockRejectedValueOnce(new Error("bad"));
    const res = await POST(makeRequest({ refreshToken: "rt" }, "bad-token"));
    expect(res.status).toBe(401);
  });

  it("returns 400 on malformed JSON", async () => {
    mockVerifyAccessToken.mockResolvedValueOnce(ACCESS_PAYLOAD);
    const req = new NextRequest("http://localhost/api/auth/mobile/logout", {
      method: "POST",
      body: "not-json",
      headers: { Authorization: "Bearer good-token" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("revokes the refresh token when it belongs to the bearer's user", async () => {
    mockVerifyAccessToken.mockResolvedValueOnce(ACCESS_PAYLOAD);
    mockVerifyRefreshToken.mockResolvedValueOnce({
      userId: "user-1",
      jti: "jti-1",
      type: "refresh",
    });

    const res = await POST(makeRequest({ refreshToken: "rt" }, "good-token"));
    expect(res.status).toBe(200);
    expect(mockRevokeRefreshToken).toHaveBeenCalledWith("jti-1");
  });

  it("does NOT revoke a refresh token belonging to a different user", async () => {
    mockVerifyAccessToken.mockResolvedValueOnce(ACCESS_PAYLOAD);
    mockVerifyRefreshToken.mockResolvedValueOnce({
      userId: "someone-else",
      jti: "jti-2",
      type: "refresh",
    });

    const res = await POST(makeRequest({ refreshToken: "rt" }, "good-token"));
    expect(res.status).toBe(200);
    expect(mockRevokeRefreshToken).not.toHaveBeenCalled();
  });

  it("still returns 200 when the refresh token is already invalid/expired", async () => {
    mockVerifyAccessToken.mockResolvedValueOnce(ACCESS_PAYLOAD);
    mockVerifyRefreshToken.mockRejectedValueOnce(new Error("expired"));

    const res = await POST(makeRequest({ refreshToken: "rt" }, "good-token"));
    expect(res.status).toBe(200);
    expect(mockRevokeRefreshToken).not.toHaveBeenCalled();
  });
});
