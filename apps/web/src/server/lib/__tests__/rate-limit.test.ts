import { describe, it, expect } from "vitest";
import { rateLimiters } from "../rate-limit";

describe("rateLimiters", () => {
  describe("auth tier (10/min per token)", () => {
    it("allows 10 calls for a fresh token then throws on the 11th", () => {
      const token = "auth-token-allows-10-then-throws";

      for (let i = 0; i < 10; i++) {
        expect(() => rateLimiters.auth.check(token)).not.toThrow();
      }

      let thrown: unknown;
      try {
        rateLimiters.auth.check(token);
      } catch (err) {
        thrown = err;
      }
      expect(thrown).toBeDefined();
      expect((thrown as { code?: string }).code).toBe("TOO_MANY_REQUESTS");
    });

    it("allows a different fresh token independently (per-token isolation)", () => {
      const exhaustedToken = "auth-token-exhausted-for-isolation-test";
      const freshToken = "auth-token-fresh-for-isolation-test";

      for (let i = 0; i < 10; i++) {
        rateLimiters.auth.check(exhaustedToken);
      }
      expect(() => rateLimiters.auth.check(exhaustedToken)).toThrow();

      // A different token must not be affected by the exhausted token's count.
      expect(() => rateLimiters.auth.check(freshToken)).not.toThrow();
    });
  });

  describe("api tier (120/min per token)", () => {
    it("allows 120 calls for a fresh token then throws on the 121st", () => {
      const token = "api-token-allows-120-then-throws";

      for (let i = 0; i < 120; i++) {
        expect(() => rateLimiters.api.check(token)).not.toThrow();
      }

      let thrown: unknown;
      try {
        rateLimiters.api.check(token);
      } catch (err) {
        thrown = err;
      }
      expect(thrown).toBeDefined();
      expect((thrown as { code?: string }).code).toBe("TOO_MANY_REQUESTS");
    });
  });
});
