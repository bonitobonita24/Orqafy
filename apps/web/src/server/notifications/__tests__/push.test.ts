/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */
/**
 * D-push — sendPushToUser tests.
 *
 * Proves:
 *  1. fans out to ALL of a user's tokens (batched to Expo)
 *  2. no-op when the user has no tokens (no fetch call)
 *  3. DeviceNotRegistered ticket → the matching token is removed
 *  4. tenant scoping: token lookup is scoped by BOTH userId AND tenantId
 *  5. an Expo/network failure never throws into the caller (fail-soft)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFindMany, mockDeleteMany } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockDeleteMany: vi.fn(),
}));

vi.mock("@orqafy/db", () => ({
  prisma: {
    devicePushToken: {
      findMany: mockFindMany,
      deleteMany: mockDeleteMany,
    },
  },
}));

import { sendPushToUser } from "@/server/notifications/push";

const fetchMock = vi.fn();

describe("sendPushToUser (D-push)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteMany.mockResolvedValue({ count: 0 });
    vi.stubGlobal("fetch", fetchMock);
  });

  it("fans out to all of a user's tokens", async () => {
    mockFindMany.mockResolvedValue([
      { id: "tok-1", token: "ExponentPushToken[aaa]" },
      { id: "tok-2", token: "ExponentPushToken[bbb]" },
    ]);
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [{ status: "ok", id: "r1" }, { status: "ok", id: "r2" }],
        }),
    });

    await sendPushToUser({
      tenantId: "tenant-A",
      userId: "user-7",
      title: "New task",
      body: "You have a new task",
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, opts] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://exp.host/--/api/v2/push/send");
    const body = JSON.parse(opts.body as string);
    expect(body).toHaveLength(2);
    expect(body[0].to).toBe("ExponentPushToken[aaa]");
    expect(body[1].to).toBe("ExponentPushToken[bbb]");
    expect(body[0].title).toBe("New task");
  });

  it("no-ops cleanly when the user has no tokens", async () => {
    mockFindMany.mockResolvedValue([]);

    await sendPushToUser({
      tenantId: "tenant-A",
      userId: "user-7",
      title: "t",
      body: "b",
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("removes a token on a DeviceNotRegistered ticket", async () => {
    mockFindMany.mockResolvedValue([
      { id: "tok-1", token: "ExponentPushToken[dead]" },
      { id: "tok-2", token: "ExponentPushToken[alive]" },
    ]);
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [
            {
              status: "error",
              message: "not registered",
              details: { error: "DeviceNotRegistered" },
            },
            { status: "ok", id: "r2" },
          ],
        }),
    });

    await sendPushToUser({
      tenantId: "tenant-A",
      userId: "user-7",
      title: "t",
      body: "b",
    });

    expect(mockDeleteMany).toHaveBeenCalledOnce();
    const where = mockDeleteMany.mock.calls[0]![0].where;
    expect(where.userId).toBe("user-7");
    expect(where.tenantId).toBe("tenant-A");
    expect(where.token.in).toEqual(["ExponentPushToken[dead]"]);
  });

  it("scopes the token lookup by tenantId AND userId (never fetches another tenant's tokens)", async () => {
    mockFindMany.mockResolvedValue([]);

    await sendPushToUser({
      tenantId: "tenant-A",
      userId: "user-7",
      title: "t",
      body: "b",
    });

    expect(mockFindMany).toHaveBeenCalledOnce();
    const where = mockFindMany.mock.calls[0]![0].where;
    expect(where.userId).toBe("user-7");
    expect(where.tenantId).toBe("tenant-A");
  });

  it("is fail-soft: a network failure does not throw into the caller", async () => {
    mockFindMany.mockResolvedValue([
      { id: "tok-1", token: "ExponentPushToken[aaa]" },
    ]);
    fetchMock.mockRejectedValue(new Error("network down"));

    await expect(
      sendPushToUser({
        tenantId: "tenant-A",
        userId: "user-7",
        title: "t",
        body: "b",
      })
    ).resolves.toBeUndefined();

    // deleteMany must never run when we never got a valid response
    expect(mockDeleteMany).not.toHaveBeenCalled();
  });

  it("is fail-soft: a thrown Prisma lookup error does not throw into the caller", async () => {
    mockFindMany.mockRejectedValue(new Error("db down"));

    await expect(
      sendPushToUser({
        tenantId: "tenant-A",
        userId: "user-7",
        title: "t",
        body: "b",
      })
    ).resolves.toBeUndefined();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
