import { describe, expect, it } from "vitest";
import {
  GENERIC_LOGIN_ERROR,
  LOGIN_ERROR_MESSAGES,
  getLoginErrorMessage,
} from "../login-error-messages";

describe("getLoginErrorMessage (ORQ-39)", () => {
  it("maps tenant_suspended to the suspension message", () => {
    expect(getLoginErrorMessage("tenant_suspended")).toBe(
      "This workspace has been suspended. Contact your administrator or Powerbyte support.",
    );
  });

  it("maps session_expired to the expiry message", () => {
    expect(getLoginErrorMessage("session_expired")).toBe(
      "Your session expired. Please sign in again.",
    );
  });

  it.each(["CredentialsSignin", "AccessDenied", "Configuration", "Verification", "Default"])(
    "maps Auth.js code %s to a known (non-generic-echo) message",
    (code) => {
      const msg = getLoginErrorMessage(code);
      expect(msg).toBe(LOGIN_ERROR_MESSAGES[code]);
      expect(msg).not.toContain(code);
    },
  );

  it("returns null when no error param is present", () => {
    expect(getLoginErrorMessage(undefined)).toBeNull();
    expect(getLoginErrorMessage("")).toBeNull();
  });

  it("returns the generic message for an unknown code and never echoes it", () => {
    const hostile = '<script>alert(1)</script> Call 555-0100 to verify your account';
    const msg = getLoginErrorMessage(hostile);
    expect(msg).toBe(GENERIC_LOGIN_ERROR);
    expect(msg).not.toContain("script");
    expect(msg).not.toContain("555-0100");
  });

  it("does not resolve inherited object keys (prototype lookup)", () => {
    expect(getLoginErrorMessage("constructor")).toBe(GENERIC_LOGIN_ERROR);
    expect(getLoginErrorMessage("__proto__")).toBe(GENERIC_LOGIN_ERROR);
    expect(getLoginErrorMessage("toString")).toBe(GENERIC_LOGIN_ERROR);
  });

  it("uses only the first value when the param is repeated", () => {
    expect(getLoginErrorMessage(["session_expired", "tenant_suspended"])).toBe(
      LOGIN_ERROR_MESSAGES.session_expired,
    );
    expect(getLoginErrorMessage([])).toBeNull();
  });
});
