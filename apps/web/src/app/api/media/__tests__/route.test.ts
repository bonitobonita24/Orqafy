// route.test.ts — /api/media proxy
//
// Covers:
//   (a) missing key -> 400 (auth not called)
//   (b) unauthenticated -> 401
//   (c) rate-limited -> 429
//   (d) not found -> 404 (no audit, no resolve)
//   (e) happy path -> 200, correct headers, audit BEFORE resolve
//   (f) resolve throws -> 502
//
// Adapted from FRMS apps/web/src/app/api/media/__tests__/route.test.ts for
// Orqafy's NextAuth `auth()` session + @orqafy/db prisma.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { TRPCError } from "@trpc/server";

const {
  mockAuth,
  mockRateLimitCheck,
  mockFindUnique,
  mockAuditCreate,
  mockResolveMediaBytes,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockRateLimitCheck: vi.fn(),
  mockFindUnique: vi.fn(),
  mockAuditCreate: vi.fn(),
  mockResolveMediaBytes: vi.fn(),
}));

vi.mock("@/server/auth", () => ({
  auth: mockAuth,
}));

vi.mock("@/server/lib/rate-limit", () => ({
  rateLimiters: {
    mediaDownload: { check: mockRateLimitCheck },
  },
}));

vi.mock("@orqafy/db", () => ({
  prisma: {
    mediaObject: { findUnique: mockFindUnique },
    auditLog: { create: mockAuditCreate },
  },
}));

vi.mock("@/server/lib/media-bytes", () => ({
  resolveMediaBytes: mockResolveMediaBytes,
}));

import { GET } from "../route";

function makeRequest(query: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/media");
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return new NextRequest(url);
}

const SESSION = {
  user: { id: "user-1", tenantId: "tenant-1", tenantSlug: "acme" },
};
const MEDIA_ROW = {
  entityType: "customer",
  mimeType: "image/jpeg",
  telegramFileId: "file-abc",
  backend: "telegram",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue(SESSION);
  mockRateLimitCheck.mockReturnValue(undefined);
});

describe("GET /api/media", () => {
  it("returns 400 when key is missing", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body).toEqual({ error: "Missing key" });
    expect(mockAuth).not.toHaveBeenCalled();
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValueOnce(null);
    const res = await GET(makeRequest({ key: "acme/customer/c1/x.jpg" }));
    expect(res.status).toBe(401);
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("returns 429 when rate-limited", async () => {
    mockRateLimitCheck.mockImplementationOnce(() => {
      throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "slow down" });
    });

    const res = await GET(makeRequest({ key: "acme/customer/c1/x.jpg" }));
    expect(res.status).toBe(429);
    const body = (await res.json()) as { error: string };
    expect(body).toEqual({ error: "Too many requests" });
  });

  it("returns 404 when the MediaObject is not found", async () => {
    mockFindUnique.mockResolvedValueOnce(null);

    const res = await GET(makeRequest({ key: "acme/customer/c1/missing.jpg" }));
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body).toEqual({ error: "Not found" });
    expect(mockAuditCreate).not.toHaveBeenCalled();
    expect(mockResolveMediaBytes).not.toHaveBeenCalled();
  });

  it("looks the MediaObject up scoped to the session tenant", async () => {
    mockFindUnique.mockResolvedValueOnce(null);
    await GET(makeRequest({ key: "acme/customer/c1/x.jpg" }));
    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId_storageKey: {
            tenantId: "tenant-1",
            storageKey: "acme/customer/c1/x.jpg",
          },
        },
      }),
    );
  });

  it("serves bytes with correct headers and audits BEFORE resolving (happy path)", async () => {
    mockFindUnique.mockResolvedValueOnce(MEDIA_ROW);
    const bytes = Buffer.from("fake-image-bytes");

    const callOrder: string[] = [];
    mockAuditCreate.mockImplementationOnce(() => {
      callOrder.push("audit");
      return Promise.resolve(undefined);
    });
    mockResolveMediaBytes.mockImplementationOnce(() => {
      callOrder.push("resolve");
      return Promise.resolve({ bytes, source: "telegram" });
    });

    const res = await GET(makeRequest({ key: "acme/customer/c1/photo-1.jpg" }));

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
    expect(res.headers.get("Content-Length")).toBe(String(bytes.byteLength));
    expect(res.headers.get("Cache-Control")).toBe(
      "private, max-age=86400, immutable",
    );
    expect(res.headers.get("Content-Security-Policy")).toBe(
      "default-src 'none'; sandbox; frame-ancestors 'none'",
    );
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Content-Disposition")).toBe("inline");

    expect(mockAuditCreate).toHaveBeenCalledWith({
      data: {
        action: "MEDIA_DOWNLOAD",
        userId: "user-1",
        entity: "customer",
        entityId: "acme/customer/c1/photo-1.jpg",
      },
    });
    expect(mockResolveMediaBytes).toHaveBeenCalledWith({
      tenantSlug: "acme",
      storageKey: "acme/customer/c1/photo-1.jpg",
      telegramFileId: "file-abc",
      mimeType: "image/jpeg",
    });

    // Audit must be recorded BEFORE the byte-resolution fetch.
    expect(callOrder).toEqual(["audit", "resolve"]);
  });

  it("returns 502 when resolveMediaBytes throws", async () => {
    mockFindUnique.mockResolvedValueOnce(MEDIA_ROW);
    mockResolveMediaBytes.mockRejectedValueOnce(new Error("both backends failed"));

    const res = await GET(makeRequest({ key: "acme/customer/c1/photo-1.jpg" }));
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string };
    expect(body).toEqual({ error: "Media temporarily unavailable" });
    expect(mockAuditCreate).toHaveBeenCalledTimes(1);
  });
});
