import { logger } from "./logger";

export function assertEncryptionKeyHealthy(): void {
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (raw === undefined || raw === "") {
    throw new Error(
      "APP_ENCRYPTION_KEY is not configured. Generate one with: openssl rand -base64 32",
    );
  }
  const decoded = Buffer.from(raw, "base64");
  if (decoded.length !== 32) {
    throw new Error(
      `APP_ENCRYPTION_KEY must decode to 32 bytes (got ${decoded.length}). Regenerate with: openssl rand -base64 32`,
    );
  }
  logger.info({ check: "encryption-key" }, "startup health check passed");
}
