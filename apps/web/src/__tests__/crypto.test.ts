/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { encrypt, decrypt } from "@/lib/crypto";

// Valid 32-byte base64 key (44 chars). Generated via `openssl rand -base64 32`.
const VALID_KEY = "tjmFm1xJiKHrSIfdoo3pUxg/JmTNuwI1WjVxoTSn0xc=";
const ORIGINAL_KEY = process.env.APP_ENCRYPTION_KEY;

beforeEach(() => {
  process.env.APP_ENCRYPTION_KEY = VALID_KEY;
});

afterAll(() => {
  if (ORIGINAL_KEY === undefined) {
    delete process.env.APP_ENCRYPTION_KEY;
  } else {
    process.env.APP_ENCRYPTION_KEY = ORIGINAL_KEY;
  }
});

describe("lib/crypto", () => {
  it("encrypt + decrypt roundtrip preserves plaintext", () => {
    const plaintext = "xnd_production_super-secret-xendit-key-12345";
    const encrypted = encrypt(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it("encrypt called twice on same plaintext returns different ciphertexts (IV randomness)", () => {
    const plaintext = "identical-input";
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe(plaintext);
    expect(decrypt(b)).toBe(plaintext);
  });

  it("decrypt of tampered ciphertext throws", () => {
    const encrypted = encrypt("original-secret");
    const parts = encrypted.split(".");
    // Flip one base64 char in ciphertext segment
    const ct = parts[2]!;
    const tamperedCt = ct.startsWith("A") ? `B${ct.slice(1)}` : `A${ct.slice(1)}`;
    const tampered = `${parts[0]}.${parts[1]}.${tamperedCt}`;
    expect(() => decrypt(tampered)).toThrow();
  });

  it("decrypt of tampered auth tag throws", () => {
    const encrypted = encrypt("original-secret");
    const parts = encrypted.split(".");
    const tag = parts[1]!;
    const tamperedTag = tag.startsWith("A") ? `B${tag.slice(1)}` : `A${tag.slice(1)}`;
    const tampered = `${parts[0]}.${tamperedTag}.${parts[2]}`;
    expect(() => decrypt(tampered)).toThrow();
  });

  it("decrypt of malformed input (missing dot-separators) throws", () => {
    expect(() => decrypt("not-a-valid-encrypted-value")).toThrow(/malformed/i);
    expect(() => decrypt("only.two-parts")).toThrow(/malformed/i);
    expect(() => decrypt("")).toThrow(/malformed/i);
  });

  it("decrypt of malformed IV length throws", () => {
    // Build a value with wrong-length IV (too short)
    const shortIv = Buffer.from("short").toString("base64url");
    const fakeTag = Buffer.alloc(16).toString("base64url");
    const fakeCt = Buffer.from("data").toString("base64url");
    expect(() => decrypt(`${shortIv}.${fakeTag}.${fakeCt}`)).toThrow(/iv/i);
  });

  it("roundtrip preserves non-ASCII (emoji, Chinese, null bytes)", () => {
    const cases = [
      "🔐 secret key 🔑",
      "上海北京广州",
      "line1\nline2\ttabbed",
      "with\x00null\x00bytes",
    ];
    for (const plaintext of cases) {
      expect(decrypt(encrypt(plaintext))).toBe(plaintext);
    }
  });

  it("missing APP_ENCRYPTION_KEY throws on encrypt and decrypt", () => {
    delete process.env.APP_ENCRYPTION_KEY;
    expect(() => encrypt("anything")).toThrow(/APP_ENCRYPTION_KEY/);
    expect(() => decrypt("a.b.c")).toThrow(/APP_ENCRYPTION_KEY/);
  });

  it("wrong-length APP_ENCRYPTION_KEY (16 bytes instead of 32) throws", () => {
    // 16 bytes base64 = "AAAAAAAAAAAAAAAAAAAAAA==" (22 chars + padding)
    process.env.APP_ENCRYPTION_KEY = Buffer.alloc(16).toString("base64");
    expect(() => encrypt("anything")).toThrow(/32 bytes/);
  });
});
