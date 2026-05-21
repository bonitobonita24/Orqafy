import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const ENCODING = "base64url" as const;

function getKey(): Buffer {
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (raw === undefined || raw === "") {
    throw new Error("APP_ENCRYPTION_KEY is not configured");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `APP_ENCRYPTION_KEY must decode to 32 bytes (got ${key.length})`,
    );
  }
  return key;
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return (
    iv.toString(ENCODING) +
    "." +
    authTag.toString(ENCODING) +
    "." +
    ciphertext.toString(ENCODING)
  );
}

export function decrypt(encrypted: string): string {
  const key = getKey();
  const parts = encrypted.split(".");
  if (parts.length !== 3) {
    throw new Error("Malformed encrypted value (expected iv.authTag.ciphertext)");
  }
  const iv = Buffer.from(parts[0]!, ENCODING);
  const authTag = Buffer.from(parts[1]!, ENCODING);
  const ciphertext = Buffer.from(parts[2]!, ENCODING);
  if (iv.length !== IV_LENGTH) {
    throw new Error(`Invalid IV length (expected ${IV_LENGTH} bytes)`);
  }
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error(`Invalid auth tag length (expected ${AUTH_TAG_LENGTH} bytes)`);
  }
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
