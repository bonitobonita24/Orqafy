import { describe, it, expect } from "vitest";
import { decideReset } from "../reset-decision";

describe("decideReset", () => {
  it("does not wipe when the same user returns (stored id matches)", () => {
    expect(
      decideReset({
        newUserId: "user-1",
        storedUserId: "user-1",
        tokenUserId: null,
        hasLocalRows: true,
      }),
    ).toBe(false);
  });

  it("wipes when a different user logs in (stored id differs)", () => {
    expect(
      decideReset({
        newUserId: "user-2",
        storedUserId: "user-1",
        tokenUserId: null,
        hasLocalRows: true,
      }),
    ).toBe(true);
  });

  it("does NOT wipe on the upgrade path: no stored id, but the token's userId matches the new login", () => {
    expect(
      decideReset({
        newUserId: "user-1",
        storedUserId: null,
        tokenUserId: "user-1",
        hasLocalRows: true,
      }),
    ).toBe(false);
  });

  it("wipes when there is no stored id but the token's userId differs from the new login", () => {
    expect(
      decideReset({
        newUserId: "user-2",
        storedUserId: null,
        tokenUserId: "user-1",
        hasLocalRows: true,
      }),
    ).toBe(true);
  });

  it("does not wipe on a true fresh install: no stored id, no token, no local rows", () => {
    expect(
      decideReset({
        newUserId: "user-1",
        storedUserId: null,
        tokenUserId: null,
        hasLocalRows: false,
      }),
    ).toBe(false);
  });

  it("falls back to the conservative wipe when the token is undecodable/missing and local rows exist", () => {
    expect(
      decideReset({
        newUserId: "user-1",
        storedUserId: null,
        tokenUserId: null,
        hasLocalRows: true,
      }),
    ).toBe(true);
  });
});
