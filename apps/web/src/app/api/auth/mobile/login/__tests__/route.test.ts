import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { TRPCError } from "@trpc/server";

const { mockRateLimitCheck, mockVerifyCredentialsByEmail, mockIssueTokenPair } = vi.hoisted(
  () => ({
    mockRateLimitCheck: vi.fn(),
    mockVerifyCredentialsByEmail: vi.fn(),
    mockIssueTokenPair: vi.fn(),
  }),
);

vi.mock("@/server/lib/rate-limit", () => ({
  rateLimiters: { auth: { check: mockRateLimitCheck } },
}));

vi.mock("@/server/auth/verify-credentials", () => ({
  verifyCredentialsByEmail: mockVerifyCredentialsByEmail,
}));

vi.mock("@/server/auth/mobile-jwt", () => ({
  issueTokenPair: mockIssueTokenPair,
}));

import { POST } from "../route";

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/auth/mobile/login", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const USER = {
  id: "user-1",
  email: "jane@acme.com",
  name: "Jane Doe",
  roles: ["admin"],
  roleId: "role-1",
  tenantSlug: "acme",
  tenantId: "tenant-1",
  securityVersion: 3,
  isDemoTenant: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRateLimitCheck.mockReturnValue(undefined);
});

describe("POST /api/auth/mobile/login", () => {
  it("returns 400 on malformed JSON", async () => {
    const req = new NextRequest("http://localhost/api/auth/mobile/login", {
      method: "POST",
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(mockVerifyCredentialsByEmail).not.toHaveBeenCalled();
  });

  it("returns 400 when body fails schema validation", async () => {
    const res = await POST(makeRequest({ email: "not-an-email", password: "" }));
    expect(res.status).toBe(400);
    expect(mockVerifyCredentialsByEmail).not.toHaveBeenCalled();
  });

  it("returns 429 when rate-limited", async () => {
    mockRateLimitCheck.mockImplementationOnce(() => {
      throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "slow down" });
    });
    const res = await POST(makeRequest({ email: "jane@acme.com", password: "hunter2" }));
    expect(res.status).toBe(429);
    expect(mockVerifyCredentialsByEmail).not.toHaveBeenCalled();
  });

  it("returns a generic 401 on invalid credentials (no enumeration signal)", async () => {
    mockVerifyCredentialsByEmail.mockResolvedValueOnce(null);
    const res = await POST(makeRequest({ email: "jane@acme.com", password: "wrong" }));
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Invalid credentials");
    expect(mockIssueTokenPair).not.toHaveBeenCalled();
  });

  it("issues a token pair and returns the AuthSession shape on success", async () => {
    mockVerifyCredentialsByEmail.mockResolvedValueOnce(USER);
    mockIssueTokenPair.mockResolvedValueOnce({
      accessToken: "access.jwt.token",
      refreshToken: "refresh.jwt.token",
    });

    const res = await POST(makeRequest({ email: "jane@acme.com", password: "hunter2" }));
    expect(res.status).toBe(200);

    expect(mockVerifyCredentialsByEmail).toHaveBeenCalledWith({
      email: "jane@acme.com",
      password: "hunter2",
    });
    expect(mockIssueTokenPair).toHaveBeenCalledWith({
      userId: USER.id,
      tenantId: USER.tenantId,
      tenantSlug: USER.tenantSlug,
      roles: USER.roles,
      securityVersion: USER.securityVersion,
    });

    const body = (await res.json()) as Record<string, unknown>;
    // Must match apps/mobile/src/lib/auth.ts AuthSession exactly.
    expect(body).toEqual({
      token: "access.jwt.token",
      refreshToken: "refresh.jwt.token",
      tenantId: USER.tenantId,
      userId: USER.id,
      roles: USER.roles,
    });
  });
});
