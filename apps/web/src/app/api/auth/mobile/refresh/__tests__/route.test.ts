import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const {
  mockVerifyRefreshToken,
  mockRevokeRefreshToken,
  mockIssueTokenPair,
  mockFindUnique,
} = vi.hoisted(() => ({
  mockVerifyRefreshToken: vi.fn(),
  mockRevokeRefreshToken: vi.fn(),
  mockIssueTokenPair: vi.fn(),
  mockFindUnique: vi.fn(),
}));

vi.mock("@orqafy/db", () => ({
  prisma: { user: { findUnique: mockFindUnique } },
}));

vi.mock("@/server/auth/mobile-jwt", () => ({
  verifyRefreshToken: mockVerifyRefreshToken,
  revokeRefreshToken: mockRevokeRefreshToken,
  issueTokenPair: mockIssueTokenPair,
}));

import { POST } from "../route";

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/auth/mobile/refresh", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const REFRESH_PAYLOAD = {
  userId: "user-1",
  tenantId: "tenant-1",
  tenantSlug: "acme",
  securityVersion: 3,
  type: "refresh" as const,
  jti: "jti-123",
};

const DB_USER = {
  id: "user-1",
  tenantId: "tenant-1",
  isActive: true,
  securityVersion: 3,
  roleId: "role-1",
  role: { name: "admin" },
  tenant: { slug: "acme", isActive: true },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/auth/mobile/refresh", () => {
  it("returns 400 on malformed JSON", async () => {
    const req = new NextRequest("http://localhost/api/auth/mobile/refresh", {
      method: "POST",
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when refreshToken is missing", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    expect(mockVerifyRefreshToken).not.toHaveBeenCalled();
  });

  it("returns 401 when the refresh token fails verification (invalid/expired/revoked)", async () => {
    mockVerifyRefreshToken.mockRejectedValueOnce(new Error("bad token"));
    const res = await POST(makeRequest({ refreshToken: "bad" }));
    expect(res.status).toBe(401);
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockIssueTokenPair).not.toHaveBeenCalled();
  });

  it("rotates: always revokes the presented jti, even on rejection paths", async () => {
    mockVerifyRefreshToken.mockResolvedValueOnce(REFRESH_PAYLOAD);
    mockFindUnique.mockResolvedValueOnce(null); // user vanished
    const res = await POST(makeRequest({ refreshToken: "rt" }));
    expect(res.status).toBe(401);
    expect(mockRevokeRefreshToken).toHaveBeenCalledWith(REFRESH_PAYLOAD.jti);
  });

  it("rejects when the user is deactivated", async () => {
    mockVerifyRefreshToken.mockResolvedValueOnce(REFRESH_PAYLOAD);
    mockFindUnique.mockResolvedValueOnce({ ...DB_USER, isActive: false });
    const res = await POST(makeRequest({ refreshToken: "rt" }));
    expect(res.status).toBe(401);
    expect(mockIssueTokenPair).not.toHaveBeenCalled();
  });

  it("rejects when the tenant is deactivated", async () => {
    mockVerifyRefreshToken.mockResolvedValueOnce(REFRESH_PAYLOAD);
    mockFindUnique.mockResolvedValueOnce({
      ...DB_USER,
      tenant: { slug: "acme", isActive: false },
    });
    const res = await POST(makeRequest({ refreshToken: "rt" }));
    expect(res.status).toBe(401);
  });

  it("rejects when securityVersion is stale (role/tenant/password changed since mint)", async () => {
    mockVerifyRefreshToken.mockResolvedValueOnce(REFRESH_PAYLOAD);
    mockFindUnique.mockResolvedValueOnce({ ...DB_USER, securityVersion: 4 });
    const res = await POST(makeRequest({ refreshToken: "rt" }));
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Invalid or expired refresh token");
    expect(mockIssueTokenPair).not.toHaveBeenCalled();
  });

  it("issues a fresh token pair on a valid, current refresh token", async () => {
    mockVerifyRefreshToken.mockResolvedValueOnce(REFRESH_PAYLOAD);
    mockFindUnique.mockResolvedValueOnce(DB_USER);
    mockIssueTokenPair.mockResolvedValueOnce({
      accessToken: "new-access",
      refreshToken: "new-refresh",
    });

    const res = await POST(makeRequest({ refreshToken: "rt" }));
    expect(res.status).toBe(200);
    expect(mockRevokeRefreshToken).toHaveBeenCalledWith(REFRESH_PAYLOAD.jti);
    expect(mockIssueTokenPair).toHaveBeenCalledWith({
      userId: DB_USER.id,
      tenantId: DB_USER.tenantId,
      tenantSlug: DB_USER.tenant.slug,
      roles: [DB_USER.role.name],
      securityVersion: DB_USER.securityVersion,
    });
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({ token: "new-access", refreshToken: "new-refresh" });
  });
});
