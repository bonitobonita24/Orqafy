import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// CRITICAL: do NOT import env.ts here — that triggers the full zod validation chain.
// Only import from the lib under test.

describe("assertEncryptionKeyHealthy", () => {
  const ORIGINAL = process.env.APP_ENCRYPTION_KEY;

  // A valid 44-char base64 string that decodes to exactly 32 bytes.
  // openssl rand -base64 32 produces 44 chars (32 bytes + newline stripped).
  const VALID_KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
  // 43 'A' + '=' = 44 chars; Buffer.from(VALID_KEY, "base64").length === 32 ✓

  // A 44-char base64 string that decodes to 33 bytes (wrong length).
  // "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==" is 46 chars → too long.
  // Build a 44-char string that decodes to 33 bytes:
  // 33 bytes → ceil(33/3)*4 = 44 chars with padding.
  const WRONG_LENGTH_KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABBB="; // 44 chars → 33 bytes

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (ORIGINAL === undefined) {
      delete process.env.APP_ENCRYPTION_KEY;
    } else {
      process.env.APP_ENCRYPTION_KEY = ORIGINAL;
    }
  });

  it("throws when APP_ENCRYPTION_KEY is undefined", async () => {
    delete process.env.APP_ENCRYPTION_KEY;
    const { assertEncryptionKeyHealthy } = await import("@/lib/startup-health-check");
    expect(() => assertEncryptionKeyHealthy()).toThrow("APP_ENCRYPTION_KEY is not configured");
  });

  it("throws when APP_ENCRYPTION_KEY is empty string", async () => {
    process.env.APP_ENCRYPTION_KEY = "";
    const { assertEncryptionKeyHealthy } = await import("@/lib/startup-health-check");
    expect(() => assertEncryptionKeyHealthy()).toThrow("APP_ENCRYPTION_KEY is not configured");
  });

  it("throws with byte-count detail when key decodes to wrong length", async () => {
    process.env.APP_ENCRYPTION_KEY = WRONG_LENGTH_KEY;
    const { assertEncryptionKeyHealthy } = await import("@/lib/startup-health-check");
    expect(() => assertEncryptionKeyHealthy()).toThrow("must decode to 32 bytes");
  });

  it("returns undefined and logs info once when key is valid", async () => {
    process.env.APP_ENCRYPTION_KEY = VALID_KEY;
    const { assertEncryptionKeyHealthy } = await import("@/lib/startup-health-check");

    // Spy on the logger imported inside the module under test.
    // We need to access it after the module is loaded.
    const loggerModule = await import("@/lib/logger");
    const infoSpy = vi.spyOn(loggerModule.logger, "info");

    const result = assertEncryptionKeyHealthy();
    expect(result).toBeUndefined();
    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy).toHaveBeenCalledWith(
      { check: "encryption-key" },
      "startup health check passed",
    );

    infoSpy.mockRestore();
  });
});
