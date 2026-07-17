/**
 * Unit tests — packages/storage/src/adapter.ts
 *
 * Covers:
 *  1. getStorageBackend/resolveBackend returns S3Adapter for minio/s3/unset,
 *     TelegramAdapter for telegram.
 *  2. S3Adapter.upload delegates to uploadObject and reports backend "s3".
 *  3. S3Adapter.getDownloadUrl delegates to createPresignedDownloadUrl.
 *  4. TelegramAdapter.upload calls uploadDocumentToTelegram and returns enriched
 *     metadata with NO DB call; getDownloadUrl returns the proxied URL.
 *  5. Magic-byte gate rejects a spoofed content-type on both adapters.
 *
 * Adapted from FRMS packages/storage/src/__tests__/adapter.test.ts for Orqafy's
 * server-side upload API (operations.ts) and 4-segment key scheme.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../operations", () => ({
  uploadObject: vi.fn(() =>
    Promise.resolve({
      storageKey: "acme/customer/cust1/generated-uuid.jpg",
      bucket: "orqafy-dev",
      sizeBytes: 6,
    }),
  ),
  createPresignedDownloadUrl: vi.fn(() =>
    Promise.resolve("https://minio.example.com/bucket/signed?X-Amz-Signature=abc"),
  ),
  deleteObject: vi.fn(() => Promise.resolve(true)),
}));

vi.mock("../telegram", () => ({
  uploadDocumentToTelegram: vi.fn(() =>
    Promise.resolve({ messageId: 42, fileId: "tg-file-id-123" }),
  ),
  getTelegramBotToken: vi.fn(() => "test-bot-token"),
  fetchTelegramFileBytes: vi.fn(),
}));

import { uploadObject, createPresignedDownloadUrl, deleteObject } from "../operations";
import { uploadDocumentToTelegram } from "../telegram";
import {
  S3Adapter,
  TelegramAdapter,
  resolveBackend,
  getStorageBackend,
} from "../adapter";

const ORIGINAL_ENV = { ...process.env };

function resetEnv() {
  process.env = { ...ORIGINAL_ENV };
}

// Valid JPEG magic bytes so the magic-byte gate passes for image/jpeg.
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x01, 0x02]);

function uploadInput(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: "tenant-cuid-1",
    tenantSlug: "acme",
    entityType: "customer",
    entityId: "cust1",
    originalFilename: "photo.jpg",
    mimeType: "image/jpeg",
    body: JPEG_BYTES,
    bucket: "orqafy-dev",
    chatId: "-100123456789",
    ...overrides,
  };
}

describe("adapter.ts", () => {
  beforeEach(() => {
    resetEnv();
    process.env["STORAGE_ENDPOINT"] = "http://localhost:9000";
    process.env["STORAGE_ACCESS_KEY"] = "minioadmin";
    process.env["STORAGE_SECRET_KEY"] = "minioadmin";
    process.env["STORAGE_BUCKET"] = "orqafy-dev";
    process.env["TELEGRAM_BOT_TOKEN"] = "test-bot-token";
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetEnv();
  });

  describe("getStorageBackend / resolveBackend", () => {
    it("defaults to minio (S3Adapter) when STORAGE_BACKEND is unset", () => {
      delete process.env["STORAGE_BACKEND"];
      expect(getStorageBackend()).toBe("minio");
      expect(resolveBackend()).toBeInstanceOf(S3Adapter);
    });

    it("returns S3Adapter for STORAGE_BACKEND=minio", () => {
      process.env["STORAGE_BACKEND"] = "minio";
      expect(getStorageBackend()).toBe("minio");
      expect(resolveBackend()).toBeInstanceOf(S3Adapter);
    });

    it("returns S3Adapter for STORAGE_BACKEND=s3", () => {
      process.env["STORAGE_BACKEND"] = "s3";
      expect(getStorageBackend()).toBe("s3");
      expect(resolveBackend()).toBeInstanceOf(S3Adapter);
    });

    it("returns TelegramAdapter for STORAGE_BACKEND=telegram", () => {
      process.env["STORAGE_BACKEND"] = "telegram";
      expect(getStorageBackend()).toBe("telegram");
      expect(resolveBackend()).toBeInstanceOf(TelegramAdapter);
    });
  });

  describe("S3Adapter", () => {
    it("upload delegates to uploadObject and reports backend s3", async () => {
      const adapter = new S3Adapter();
      const result = await adapter.upload(uploadInput());

      expect(uploadObject).toHaveBeenCalledTimes(1);
      expect(result.backend).toBe("s3");
      expect(result.storageKey).toBe("acme/customer/cust1/generated-uuid.jpg");
      expect(result.mimeType).toBe("image/jpeg");
      expect(result.sizeBytes).toBe(6);
      expect(result.telegramFileId).toBeUndefined();
    });

    it("upload rejects a spoofed content-type (magic-byte gate)", async () => {
      const adapter = new S3Adapter();
      // PNG magic bytes but declared as image/jpeg.
      const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00]);
      await expect(
        adapter.upload(uploadInput({ body: png, mimeType: "image/jpeg" })),
      ).rejects.toThrow(/File signature does not match/);
      expect(uploadObject).not.toHaveBeenCalled();
    });

    it("getDownloadUrl delegates to createPresignedDownloadUrl", async () => {
      const adapter = new S3Adapter();
      const url = await adapter.getDownloadUrl("acme/customer/cust1/x.jpg", "acme");
      expect(url).toBe("https://minio.example.com/bucket/signed?X-Amz-Signature=abc");
      expect(createPresignedDownloadUrl).toHaveBeenCalledTimes(1);
    });

    it("delete delegates to deleteObject", async () => {
      const adapter = new S3Adapter();
      await adapter.delete("acme/customer/cust1/x.jpg", "acme");
      expect(deleteObject).toHaveBeenCalledTimes(1);
    });
  });

  describe("TelegramAdapter", () => {
    it("getDownloadUrl returns the exact proxied URL with no network/DB calls", async () => {
      const adapter = new TelegramAdapter();
      const url = await adapter.getDownloadUrl("acme/customer/cust1/abc 123.jpg", "acme");
      expect(url).toBe(
        `/api/media?key=${encodeURIComponent("acme/customer/cust1/abc 123.jpg")}`,
      );
      expect(uploadDocumentToTelegram).not.toHaveBeenCalled();
    });

    it("upload calls uploadDocumentToTelegram and returns enriched metadata, no DB call", async () => {
      const adapter = new TelegramAdapter();
      const result = await adapter.upload(uploadInput());

      expect(uploadDocumentToTelegram).toHaveBeenCalledTimes(1);
      const call = vi.mocked(uploadDocumentToTelegram).mock.calls[0]?.[0];
      expect(call?.chatId).toBe("-100123456789");
      expect(call?.botToken).toBe("test-bot-token");
      expect(call?.caption).toContain("acme");
      expect(call?.caption).toContain("customer");

      expect(result.backend).toBe("telegram");
      expect(result.telegramFileId).toBe("tg-file-id-123");
      expect(result.telegramMessageId).toBe(42);
      expect(result.telegramChatId).toBe("-100123456789");
      expect(result.sizeBytes).toBe(JPEG_BYTES.length);
      expect(result.mimeType).toBe("image/jpeg");
      expect(result.storageKey).toMatch(
        /^acme\/customer\/cust1\/[0-9a-f-]{36}\.jpg$/,
      );
      // Never hit S3.
      expect(uploadObject).not.toHaveBeenCalled();
    });

    it("upload throws when chatId is missing", async () => {
      const adapter = new TelegramAdapter();
      await expect(
        adapter.upload(uploadInput({ chatId: "" })),
      ).rejects.toThrow(/chatId/);
    });

    it("upload rejects a spoofed content-type (magic-byte gate)", async () => {
      const adapter = new TelegramAdapter();
      const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00]);
      await expect(
        adapter.upload(uploadInput({ body: png, mimeType: "image/jpeg" })),
      ).rejects.toThrow(/File signature does not match/);
      expect(uploadDocumentToTelegram).not.toHaveBeenCalled();
    });

    it("delete is a best-effort no-op (does not throw)", async () => {
      const adapter = new TelegramAdapter();
      await expect(
        adapter.delete("acme/customer/cust1/abc.jpg", "acme"),
      ).resolves.toBeUndefined();
    });
  });
});
