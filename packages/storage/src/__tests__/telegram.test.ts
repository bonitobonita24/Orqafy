/**
 * Unit tests — packages/storage/src/telegram.ts
 *
 * Mocks global `fetch`; no network access, no DB. Covers:
 *  1. successful sendDocument returns fileId
 *  2. coerced-to-photo fallback path
 *  3. getFile -> download happy path
 *  4. 429 with retry_after honoured then succeeds
 *  5. missing token throws
 *
 * Ported faithfully from FRMS packages/storage/src/__tests__/telegram.test.ts.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchTelegramFileBytes,
  getTelegramBotToken,
  uploadDocumentToTelegram,
} from "../telegram";

const BOT_TOKEN = "test-bot-token";
const CHAT_ID = "-1000000000";

function jsonResponse(
  body: unknown,
  init?: { status?: number; headers?: Record<string, string> },
): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
}

describe("telegram.ts", () => {
  const originalFetch = global.fetch;
  const originalEnv = process.env["TELEGRAM_BOT_TOKEN"];

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.useRealTimers();
    if (originalEnv === undefined) {
      delete process.env["TELEGRAM_BOT_TOKEN"];
    } else {
      process.env["TELEGRAM_BOT_TOKEN"] = originalEnv;
    }
  });

  describe("uploadDocumentToTelegram", () => {
    it("returns fileId from a successful sendDocument (document field)", async () => {
      const fetchMock = vi.fn((url: string) => {
        expect(url).toContain(`/bot${BOT_TOKEN}/sendDocument`);
        return Promise.resolve(
          jsonResponse({
            ok: true,
            result: {
              message_id: 42,
              document: {
                file_id: "doc-file-id-123",
                file_unique_id: "uniq-1",
                file_name: "photo.jpg",
                mime_type: "image/jpeg",
                file_size: 1234,
              },
            },
          }),
        );
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const result = await uploadDocumentToTelegram({
        botToken: BOT_TOKEN,
        chatId: CHAT_ID,
        bytes: new Uint8Array([1, 2, 3]),
        filename: "photo.jpg",
        mimeType: "image/jpeg",
        caption: "acme · customer · acme/customer/abc/def.jpg",
      });

      expect(result).toEqual({ messageId: 42, fileId: "doc-file-id-123" });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("falls back to the largest photo file_id when Telegram coerces to a photo", async () => {
      const fetchMock = vi.fn(() =>
        Promise.resolve(
          jsonResponse({
            ok: true,
            result: {
              message_id: 43,
              photo: [
                { file_id: "small", file_unique_id: "u1", width: 90, height: 90, file_size: 10 },
                { file_id: "large", file_unique_id: "u2", width: 800, height: 800, file_size: 5000 },
              ],
            },
          }),
        ),
      );
      global.fetch = fetchMock;

      const result = await uploadDocumentToTelegram({
        botToken: BOT_TOKEN,
        chatId: CHAT_ID,
        bytes: new Uint8Array([9, 9]),
        filename: "small.jpg",
      });

      expect(result).toEqual({ messageId: 43, fileId: "large" });
    });

    it("throws a descriptive error when sendDocument fails", async () => {
      const fetchMock = vi.fn(() =>
        Promise.resolve(jsonResponse({ ok: false, description: "chat not found" })),
      );
      global.fetch = fetchMock;

      await expect(
        uploadDocumentToTelegram({
          botToken: BOT_TOKEN,
          chatId: "bad-chat",
          bytes: new Uint8Array([1]),
          filename: "x.png",
        }),
      ).rejects.toThrow(/Telegram sendDocument failed: chat not found/);
    });
  });

  describe("fetchTelegramFileBytes", () => {
    it("resolves file_path via getFile then downloads bytes", async () => {
      const fileBytes = new TextEncoder().encode("hello-bytes");
      const fetchMock = vi.fn((url: string) => {
        if (url.includes("/getFile")) {
          return Promise.resolve(
            jsonResponse({
              ok: true,
              result: {
                file_id: "abc123",
                file_unique_id: "u1",
                file_size: fileBytes.byteLength,
                file_path: "documents/file_1.jpg",
              },
            }),
          );
        }
        if (url.includes("/file/bot")) {
          return Promise.resolve(new Response(fileBytes, { status: 200 }));
        }
        return Promise.reject(new Error(`unexpected URL: ${url}`));
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const result = await fetchTelegramFileBytes({ botToken: BOT_TOKEN, fileId: "abc123" });

      expect(result.filePath).toBe("documents/file_1.jpg");
      expect(new Uint8Array(result.bytes)).toEqual(fileBytes);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("honours retry_after on a 429 from getFile then succeeds", async () => {
      const fileBytes = new TextEncoder().encode("retried-bytes");
      let getFileCalls = 0;
      const fetchMock = vi.fn((url: string) => {
        if (url.includes("/getFile")) {
          getFileCalls += 1;
          if (getFileCalls === 1) {
            return Promise.resolve(
              jsonResponse(
                {
                  ok: false,
                  error_code: 429,
                  description: "Too Many Requests: retry after 1",
                  parameters: { retry_after: 1 },
                },
                { status: 429 },
              ),
            );
          }
          return Promise.resolve(
            jsonResponse({
              ok: true,
              result: {
                file_id: "abc123",
                file_unique_id: "u1",
                file_size: fileBytes.byteLength,
                file_path: "documents/file_2.jpg",
              },
            }),
          );
        }
        if (url.includes("/file/bot")) {
          return Promise.resolve(new Response(fileBytes, { status: 200 }));
        }
        return Promise.reject(new Error(`unexpected URL: ${url}`));
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const promise = fetchTelegramFileBytes({ botToken: BOT_TOKEN, fileId: "abc123" });
      await vi.advanceTimersByTimeAsync(1000);
      const result = await promise;

      expect(getFileCalls).toBe(2);
      expect(result.filePath).toBe("documents/file_2.jpg");
      expect(new Uint8Array(result.bytes)).toEqual(fileBytes);
    });

    it("honours retry-after on a 429 from the file download then succeeds", async () => {
      const fileBytes = new TextEncoder().encode("download-retried");
      let downloadCalls = 0;
      const fetchMock = vi.fn((url: string) => {
        if (url.includes("/getFile")) {
          return Promise.resolve(
            jsonResponse({
              ok: true,
              result: {
                file_id: "abc123",
                file_unique_id: "u1",
                file_size: fileBytes.byteLength,
                file_path: "documents/file_3.jpg",
              },
            }),
          );
        }
        if (url.includes("/file/bot")) {
          downloadCalls += 1;
          if (downloadCalls === 1) {
            return Promise.resolve(
              new Response(null, {
                status: 429,
                headers: { "retry-after": "1" },
              }),
            );
          }
          return Promise.resolve(new Response(fileBytes, { status: 200 }));
        }
        return Promise.reject(new Error(`unexpected URL: ${url}`));
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const promise = fetchTelegramFileBytes({ botToken: BOT_TOKEN, fileId: "abc123" });
      await vi.advanceTimersByTimeAsync(1000);
      const result = await promise;

      expect(downloadCalls).toBe(2);
      expect(new Uint8Array(result.bytes)).toEqual(fileBytes);
    });

    it("throws after exhausting retries on a persistent 429", async () => {
      const fetchMock = vi.fn((url: string) => {
        if (url.includes("/getFile")) {
          return Promise.resolve(
            jsonResponse(
              { ok: false, error_code: 429, description: "rate limited", parameters: { retry_after: 0 } },
              { status: 429 },
            ),
          );
        }
        return Promise.reject(new Error(`unexpected URL: ${url}`));
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const promise = fetchTelegramFileBytes({ botToken: BOT_TOKEN, fileId: "abc123", maxRetries: 1 });
      const assertion = expect(promise).rejects.toThrow(/Telegram getFile failed: rate limited/);
      await vi.runAllTimersAsync();
      await assertion;
    });
  });

  describe("getTelegramBotToken", () => {
    it("returns the trimmed token when set", () => {
      process.env["TELEGRAM_BOT_TOKEN"] = "  my-token-value  ";
      expect(getTelegramBotToken()).toBe("my-token-value");
    });

    it("throws a clear error when the env var is unset", () => {
      delete process.env["TELEGRAM_BOT_TOKEN"];
      expect(() => getTelegramBotToken()).toThrow(/TELEGRAM_BOT_TOKEN environment variable is not set/);
    });

    it("throws a clear error when the env var is empty/whitespace", () => {
      process.env["TELEGRAM_BOT_TOKEN"] = "   ";
      expect(() => getTelegramBotToken()).toThrow(/TELEGRAM_BOT_TOKEN environment variable is not set/);
    });
  });
});
