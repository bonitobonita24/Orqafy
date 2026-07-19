import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockVerifyAccessToken, mockUpsert } = vi.hoisted(() => ({
  mockVerifyAccessToken: vi.fn(),
  mockUpsert: vi.fn(),
}));

vi.mock("@/server/auth/mobile-jwt", () => ({
  verifyAccessToken: mockVerifyAccessToken,
}));

vi.mock("@orqafy/db", () => ({
  prisma: { devicePushToken: { upsert: mockUpsert } },
}));

import { POST } from "../route";

function makeRequest(body: unknown, bearer?: string): NextRequest {
  return new NextRequest("http://localhost/api/push-token", {
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

describe("POST /api/push-token", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await POST(makeRequest({ token: "expo-token", platform: "ios" }));
    expect(res.status).toBe(401);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("returns 401 when the bearer token is invalid", async () => {
    mockVerifyAccessToken.mockRejectedValueOnce(new Error("bad"));
    const res = await POST(makeRequest({ token: "expo-token", platform: "ios" }, "bad"));
    expect(res.status).toBe(401);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("returns 400 when the body fails schema validation", async () => {
    mockVerifyAccessToken.mockResolvedValueOnce(ACCESS_PAYLOAD);
    const res = await POST(makeRequest({ token: "" }, "good"));
    expect(res.status).toBe(400);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("upserts scoped to (userId, token) with the bearer's tenantId on create", async () => {
    mockVerifyAccessToken.mockResolvedValueOnce(ACCESS_PAYLOAD);
    mockUpsert.mockResolvedValueOnce({});

    const res = await POST(makeRequest({ token: "expo-token-abc", platform: "ios" }, "good"));
    expect(res.status).toBe(200);
    expect(mockUpsert).toHaveBeenCalledTimes(1);

    const call = mockUpsert.mock.calls[0]?.[0] as {
      where: unknown;
      create: unknown;
      update: { platform: string; lastSeenAt: unknown };
    };
    expect(call.where).toEqual({ userId_token: { userId: "user-1", token: "expo-token-abc" } });
    expect(call.create).toEqual({
      userId: "user-1",
      tenantId: "tenant-1",
      token: "expo-token-abc",
      platform: "ios",
    });
    expect(call.update.platform).toBe("ios");
    expect(call.update.lastSeenAt).toBeInstanceOf(Date);
  });
});
