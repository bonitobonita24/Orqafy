/**
 * ORQ-39 — maps the `?error=` code on /login to fixed, human copy.
 *
 * Sources of codes:
 *   - `tenant_suspended` / `session_expired` — middleware.ts and
 *     server/auth/require-tenant-session.ts (ORQ-36/38).
 *   - Auth.js v5 codes — `pages.error` and `pages.signIn` both point at /login
 *     (server/auth/config.ts), so Auth.js may append Configuration,
 *     AccessDenied, Verification, Default, or CredentialsSignin.
 *
 * The raw param is NEVER rendered: unknown codes collapse to one generic
 * message so a crafted link can't inject text (phishing) or markup (XSS).
 */

export const GENERIC_LOGIN_ERROR =
  "Something went wrong while signing you in. Please try again.";

export const LOGIN_ERROR_MESSAGES: Readonly<Record<string, string>> = Object.freeze({
  tenant_suspended:
    "This workspace has been suspended. Contact your administrator or Powerbyte support.",
  session_expired: "Your session expired. Please sign in again.",
  CredentialsSignin: "Invalid email, password, or workspace.",
  AccessDenied: "You don't have access to that workspace.",
  Verification: "This sign-in link has expired or was already used.",
  Configuration:
    "Sign-in is temporarily unavailable. Please try again later or contact Powerbyte support.",
  Default: GENERIC_LOGIN_ERROR,
});

export function getLoginErrorMessage(
  raw: string | string[] | undefined,
): string | null {
  const code = Array.isArray(raw) ? raw[0] : raw;
  if (code === undefined || code === "") return null;
  return Object.prototype.hasOwnProperty.call(LOGIN_ERROR_MESSAGES, code)
    ? (LOGIN_ERROR_MESSAGES[code] as string)
    : GENERIC_LOGIN_ERROR;
}
