import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/env", () => ({
  env: { TURNSTILE_SECRET_KEY: "test-secret-key" },
}));

import { verifyTurnstile } from "@/lib/turnstile";

describe("verifyTurnstile", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns true when siteverify responds success=true", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({ success: true }),
    });
    const result = await verifyTurnstile("good-token", "1.2.3.4");
    expect(result).toBe(true);
  });

  it("returns false when siteverify responds success=false", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({ success: false, "error-codes": ["invalid-input-response"] }),
    });
    const result = await verifyTurnstile("bad-token", "1.2.3.4");
    expect(result).toBe(false);
  });

  it("returns false when siteverify response omits success field", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({}),
    });
    const result = await verifyTurnstile("token", "1.2.3.4");
    expect(result).toBe(false);
  });

  it("returns false when fetch rejects (network error)", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("network down"));
    const result = await verifyTurnstile("token", "1.2.3.4");
    expect(result).toBe(false);
  });

  it("POSTs the secret, token, and remoteip to the siteverify URL", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue({ json: () => Promise.resolve({ success: true }) });
    await verifyTurnstile("the-token", "9.9.9.9");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: "test-secret-key",
          response: "the-token",
          remoteip: "9.9.9.9",
        }),
      }),
    );
  });

  it("returns false when response.json() throws (malformed body)", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.reject(new Error("malformed")),
    });
    const result = await verifyTurnstile("token", "1.2.3.4");
    expect(result).toBe(false);
  });
});
