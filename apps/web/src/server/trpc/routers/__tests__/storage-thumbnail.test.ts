/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
/**
 * feat/upload-thumbnails — storage.uploadThumbnail
 *
 * Covers:
 *  1. Happy path: creates a variant:"thumbnail" MediaObject with parentId set
 *     to the original's MediaObject id, and sets Attachment.thumbnailKey.
 *  2. NOT_FOUND when the parent attachment does not belong to the caller's tenant.
 *  3. NOT_FOUND when the parent attachment has no MediaObject ledger row.
 *  4. FORBIDDEN when the thumbnail bytes would exceed the tenant's storage quota.
 *  5. Backend upload failure surfaces as BAD_REQUEST — the client-side caller
 *     (file-upload.tsx) treats this as non-fatal and leaves thumbnailKey null;
 *     this test verifies the server-side contract that failure never touches
 *     the DB (no dangling MediaObject / no thumbnailKey write on error).
 *  6. The default (no-variant) uploadDirect path is unaffected by these changes.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import type * as OrqafyDb from "@orqafy/db";
import type * as OrqafyStorage from "@orqafy/storage";

const {
  mockAttachmentFindFirst,
  mockAttachmentUpdate,
  mockAttachmentCreate,
  mockMediaObjectFindUnique,
  mockMediaObjectCreate,
  mockMediaObjectUpsert,
  mockTenantFindUnique,
  mockTenantUpdate,
  mockWriteAuditLog,
  mockTransaction,
  mockResolveBackendUpload,
  mockGetStorageBackend,
} = vi.hoisted(() => ({
  mockAttachmentFindFirst: vi.fn(),
  mockAttachmentUpdate: vi.fn(),
  mockAttachmentCreate: vi.fn(),
  mockMediaObjectFindUnique: vi.fn(),
  mockMediaObjectCreate: vi.fn(),
  mockMediaObjectUpsert: vi.fn(),
  mockTenantFindUnique: vi.fn(),
  mockTenantUpdate: vi.fn(),
  mockWriteAuditLog: vi.fn(),
  mockTransaction: vi.fn(),
  mockResolveBackendUpload: vi.fn(),
  mockGetStorageBackend: vi.fn(),
}));

vi.mock("@orqafy/db", async () => {
  const actual = await vi.importActual<typeof OrqafyDb>("@orqafy/db");
  const prismaMock = {
    attachment: {
      findFirst: mockAttachmentFindFirst,
      update: mockAttachmentUpdate,
      create: mockAttachmentCreate,
    },
    mediaObject: {
      findUnique: mockMediaObjectFindUnique,
      create: mockMediaObjectCreate,
      upsert: mockMediaObjectUpsert,
    },
    tenant: {
      findUnique: mockTenantFindUnique,
      update: mockTenantUpdate,
    },
    $transaction: mockTransaction,
  };
  return {
    ...actual,
    prisma: prismaMock,
    writeAuditLog: mockWriteAuditLog,
  };
});

vi.mock("@orqafy/storage", async () => {
  const actual = await vi.importActual<typeof OrqafyStorage>("@orqafy/storage");
  return {
    ...actual,
    createStorageClient: vi.fn(() => ({})),
    storageConfigFromEnv: vi.fn(() => ({})),
    resolveBackend: vi.fn(() => ({ upload: mockResolveBackendUpload })),
    getStorageBackend: mockGetStorageBackend,
  };
});

import { storageRouter } from "@/server/trpc/routers/storage";
import { createTRPCRouter, createCallerFactory } from "@/server/trpc/trpc";

const testRouter = createTRPCRouter({ storage: storageRouter });
const createCaller = createCallerFactory(testRouter);

function makeReq(): NextRequest {
  return {} as NextRequest;
}

function ctx(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    req: makeReq(),
    userId: "user-1",
    roles: ["Admin"],
    roleId: "role-caller",
    tenantSlug: "acme",
    tenantId: "tenant-A",
    securityVersion: 1,
    isDemoTenant: false,
    session: null,
    ...overrides,
  };
}

const PARENT_ATTACHMENT = {
  id: "clparent0000000000000001",
  tenantId: "tenant-A",
  entityType: "expense",
  entityId: "clentity000000000000001",
  storageKey: "acme/expense/clentity000000000000001/original-uuid.jpg",
  filename: "receipt.jpg",
  mimeType: "image/jpeg",
  sizeBytes: 500_000n,
  uploadedByUserId: "user-1",
  thumbnailKey: null,
  createdAt: new Date(),
};

const PARENT_MEDIA_OBJECT = {
  id: "clmedia00000000000000001",
  tenantId: "tenant-A",
  storageKey: PARENT_ATTACHMENT.storageKey,
  entityType: "expense",
  backend: "s3",
  variant: "original",
  parentId: null,
};

function thumbnailInput(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    filename: "receipt.jpg",
    contentType: "image/jpeg",
    entityType: "expense" as const,
    entityId: "clentity000000000000001",
    parentAttachmentId: PARENT_ATTACHMENT.id,
    bodyBase64: Buffer.from("thumb-bytes").toString("base64"),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env["STORAGE_BUCKET"] = "test-bucket";

  mockGetStorageBackend.mockReturnValue("s3");
  mockAttachmentFindFirst.mockResolvedValue(PARENT_ATTACHMENT);
  mockMediaObjectFindUnique.mockResolvedValue(PARENT_MEDIA_OBJECT);
  mockTenantFindUnique.mockResolvedValue({
    storageBytesUsed: 0n,
    plan: { maxStorageMb: 500, name: "Free" },
  });
  mockResolveBackendUpload.mockResolvedValue({
    storageKey: "acme/expense/clentity000000000000001/thumb-uuid.jpg",
    bucket: "test-bucket",
    sizeBytes: 12,
    mimeType: "image/jpeg",
    backend: "s3",
  });

  // Default $transaction: invoke the callback with the same mocked "tx" shape
  // the real router uses inside its transaction block.
  mockTransaction.mockImplementation((fn: any) =>
    fn({
      mediaObject: { create: mockMediaObjectCreate },
      tenant: { update: mockTenantUpdate },
      attachment: { update: mockAttachmentUpdate },
    }),
  );
});

describe("storage.uploadThumbnail", () => {
  it("creates a variant:'thumbnail' MediaObject linked to the parent, and sets Attachment.thumbnailKey", async () => {
    const caller = createCaller(ctx());

    const result = await caller.storage.uploadThumbnail(thumbnailInput());

    expect(result.thumbnailKey).toBe("acme/expense/clentity000000000000001/thumb-uuid.jpg");

    expect(mockMediaObjectCreate).toHaveBeenCalledTimes(1);
    const createArgs = mockMediaObjectCreate.mock.calls[0]?.[0];
    expect(createArgs.data).toMatchObject({
      tenantId: "tenant-A",
      storageKey: "acme/expense/clentity000000000000001/thumb-uuid.jpg",
      variant: "thumbnail",
      parentId: PARENT_MEDIA_OBJECT.id,
    });

    expect(mockAttachmentUpdate).toHaveBeenCalledTimes(1);
    const updateArgs = mockAttachmentUpdate.mock.calls[0]?.[0];
    expect(updateArgs).toMatchObject({
      where: { id: PARENT_ATTACHMENT.id },
      data: { thumbnailKey: "acme/expense/clentity000000000000001/thumb-uuid.jpg" },
    });

    // No duplicate user-facing Attachment row is created for the thumbnail.
    expect(mockAttachmentCreate).not.toHaveBeenCalled();
  });

  it("counts the thumbnail's bytes toward the tenant's storage quota", async () => {
    const caller = createCaller(ctx());
    await caller.storage.uploadThumbnail(thumbnailInput());

    expect(mockTenantUpdate).toHaveBeenCalledTimes(1);
    const updateArgs = mockTenantUpdate.mock.calls[0]?.[0];
    expect(updateArgs).toMatchObject({
      where: { id: "tenant-A" },
      data: { storageBytesUsed: { increment: 12n } },
    });
  });

  it("rejects with NOT_FOUND when the parent attachment does not belong to the caller's tenant", async () => {
    mockAttachmentFindFirst.mockResolvedValue(null);
    const caller = createCaller(ctx());

    await expect(caller.storage.uploadThumbnail(thumbnailInput())).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(mockResolveBackendUpload).not.toHaveBeenCalled();
    expect(mockMediaObjectCreate).not.toHaveBeenCalled();
  });

  it("rejects with NOT_FOUND when the parent attachment has no MediaObject ledger row", async () => {
    mockMediaObjectFindUnique.mockResolvedValue(null);
    const caller = createCaller(ctx());

    await expect(caller.storage.uploadThumbnail(thumbnailInput())).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(mockResolveBackendUpload).not.toHaveBeenCalled();
  });

  it("rejects with FORBIDDEN when the thumbnail would exceed the tenant's storage quota", async () => {
    mockTenantFindUnique.mockResolvedValue({
      storageBytesUsed: BigInt(500 * 1024 * 1024) - 1n, // 1 byte under the 500MB cap
      plan: { maxStorageMb: 500, name: "Free" },
    });
    const caller = createCaller(ctx());

    await expect(
      caller.storage.uploadThumbnail(thumbnailInput({ bodyBase64: Buffer.from("x".repeat(10)).toString("base64") })),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mockResolveBackendUpload).not.toHaveBeenCalled();
  });

  it("surfaces a backend upload failure as BAD_REQUEST and writes nothing to the DB (thumbnailKey stays untouched)", async () => {
    mockResolveBackendUpload.mockRejectedValue(new Error("telegram upload failed"));
    const caller = createCaller(ctx());

    await expect(caller.storage.uploadThumbnail(thumbnailInput())).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });

    expect(mockMediaObjectCreate).not.toHaveBeenCalled();
    expect(mockAttachmentUpdate).not.toHaveBeenCalled();
    expect(mockTenantUpdate).not.toHaveBeenCalled();
  });

  it("rejects an empty bodyBase64 at the Zod input layer", async () => {
    const caller = createCaller(ctx());

    await expect(caller.storage.uploadThumbnail(thumbnailInput({ bodyBase64: "" }))).rejects.toBeTruthy();
    expect(mockResolveBackendUpload).not.toHaveBeenCalled();
  });
});

describe("storage.uploadDirect (regression — default no-variant path unaffected)", () => {
  it("still creates the original MediaObject (variant defaults to 'original' at the DB layer) and the user-facing Attachment", async () => {
    mockAttachmentCreate.mockResolvedValue({
      id: "clnewattach000000000001",
      storageKey: "acme/expense/clentity000000000000001/new-upload.jpg",
    });
    mockResolveBackendUpload.mockResolvedValue({
      storageKey: "acme/expense/clentity000000000000001/new-upload.jpg",
      bucket: "test-bucket",
      sizeBytes: 999,
      mimeType: "image/jpeg",
      backend: "s3",
    });
    mockTransaction.mockImplementation((fn: any) =>
      fn({
        attachment: { create: mockAttachmentCreate },
        tenant: { update: mockTenantUpdate },
        mediaObject: { upsert: mockMediaObjectUpsert },
        auditLog: { create: vi.fn() },
      }),
    );

    const caller = createCaller(ctx());
    const result = await caller.storage.uploadDirect({
      filename: "new-upload.jpg",
      contentType: "image/jpeg",
      entityType: "expense",
      entityId: "clentity000000000000001",
      bodyBase64: Buffer.from("original-bytes").toString("base64"),
    });

    expect(result.id).toBe("clnewattach000000000001");
    expect(mockAttachmentCreate).toHaveBeenCalledTimes(1);
    expect(mockMediaObjectUpsert).toHaveBeenCalledTimes(1);
    // The uploadDirect path never touches variant/parentId — those columns
    // default at the DB layer to "original" / NULL and are untouched here.
    const upsertArgs = mockMediaObjectUpsert.mock.calls[0]?.[0];
    expect(upsertArgs.create).not.toHaveProperty("variant");
    expect(upsertArgs.create).not.toHaveProperty("parentId");
  });
});
