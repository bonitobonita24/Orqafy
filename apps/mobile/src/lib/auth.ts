import * as SecureStore from "expo-secure-store";
import { AUTH_TOKEN_KEY, REFRESH_TOKEN_KEY, TENANT_ID_KEY, USER_ID_KEY } from "@/constants";
import { env } from "@/env";

export interface AuthSession {
  token: string;
  refreshToken: string;
  tenantId: string;
  userId: string;
  roles: string[];
}

// Shape returned by POST /api/auth/mobile/refresh — no tenantId/userId/roles,
// see apps/web/src/app/api/auth/mobile/refresh/route.ts.
interface RefreshedTokenPair {
  token: string;
  refreshToken: string;
}

export async function saveSession(session: AuthSession): Promise<void> {
  await SecureStore.setItemAsync(AUTH_TOKEN_KEY, session.token);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, session.refreshToken);
  await SecureStore.setItemAsync(TENANT_ID_KEY, session.tenantId);
}

export async function clearSession(): Promise<void> {
  // Best-effort migration: on an install that predates USER_ID_KEY, this may
  // be the LAST moment the auth token (and therefore its userId claim) is
  // still readable — clearSession runs on both the manual-logout path and
  // the failed-refresh path, both of which land the user back on the login
  // screen with the token already gone. The login-time same-user-vs-
  // different-user wipe decision (sync/reset-on-login.ts) depends on
  // USER_ID_KEY being set, so we seed it here, right before deletion,
  // instead of relying on a token that will no longer exist by login time.
  // Never overwrite an already-stored userId, and never let a failure here
  // block clearing the session — an unseeded USER_ID_KEY only risks an
  // extra (safe) wipe, whereas a session that fails to clear is a real
  // security regression.
  try {
    const existingUserId = await getStoredUserId();
    if (existingUserId === null) {
      const token = await getStoredToken();
      if (token !== null) {
        const userId = decodeJwtUserId(token);
        if (userId !== null) {
          await setStoredUserId(userId);
        }
      }
    }
  } catch {
    // Swallow — seeding is best-effort and must never block session clearing.
  }

  await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  await SecureStore.deleteItemAsync(TENANT_ID_KEY);
}

export async function getStoredToken(): Promise<string | null> {
  return SecureStore.getItemAsync(AUTH_TOKEN_KEY);
}

export async function getStoredRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function getStoredTenantId(): Promise<string | null> {
  return SecureStore.getItemAsync(TENANT_ID_KEY);
}

/**
 * The userId of whoever last completed the local-database user-switch check
 * (see sync/reset-on-login.ts). Deliberately NOT cleared by clearSession():
 * a worker who logs out and back in as themselves must keep their queued
 * offline edits, so the stored userId must survive logout and only change
 * when a DIFFERENT user actually authenticates.
 */
export async function getStoredUserId(): Promise<string | null> {
  return SecureStore.getItemAsync(USER_ID_KEY);
}

export async function setStoredUserId(userId: string): Promise<void> {
  await SecureStore.setItemAsync(USER_ID_KEY, userId);
}

export async function isAuthenticated(): Promise<boolean> {
  const token = await getStoredToken();
  return token !== null;
}

const BASE64_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/**
 * Decodes a base64url string to a UTF-8 string, WITHOUT relying on `atob`
 * (not reliably available across RN/Hermes environments) or a `Buffer`
 * polyfill. No new dependency — a small local lookup table is enough for
 * this one-off decode. Throws on malformed input; callers must catch.
 */
function base64UrlDecode(input: string): string {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);

  let bits = "";
  for (const char of padded) {
    if (char === "=") continue;
    const index = BASE64_CHARS.indexOf(char);
    if (index === -1) {
      throw new Error("base64UrlDecode: invalid character");
    }
    bits += index.toString(2).padStart(6, "0");
  }

  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }

  // decodeURIComponent(escape(...)) turns the raw byte string into proper
  // UTF-8 — standard trick for base64-decoding non-ASCII payloads without a
  // dedicated text-decoding API.
  const rawBytes = bytes.map((byte) => String.fromCharCode(byte)).join("");
  return decodeURIComponent(escape(rawBytes));
}

/**
 * Extracts the `userId` claim from a JWT WITHOUT verifying its signature.
 *
 * ⚠️ NOT AN AUTHORIZATION CHECK. This is a local, unverified heuristic used
 * ONLY to decide whether the login-time local-database wipe (see
 * sync/reset-on-login.ts) is looking at the SAME previously-signed-in user
 * or a different one on an install that predates the stored-userId key. A
 * forged/tampered token could at most cause an incorrect wipe decision on
 * the user's OWN device — it can never grant access to anything, since the
 * server independently authenticates every request by its own bearer-token
 * verification. Never reuse this function anywhere access control matters.
 *
 * Returns null (never throws) on any malformed/undecodable token so a
 * corrupt stored token can never crash login.
 */
export function decodeJwtUserId(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payloadSegment = parts[1];
    if (payloadSegment === undefined || payloadSegment.length === 0) return null;
    const payload: unknown = JSON.parse(base64UrlDecode(payloadSegment));
    if (payload === null || typeof payload !== "object") return null;
    const userId = (payload as Record<string, unknown>).userId;
    return typeof userId === "string" && userId.length > 0 ? userId : null;
  } catch {
    return null;
  }
}

/**
 * Rotates the stored access/refresh token pair via POST /api/auth/mobile/refresh.
 * Called by api/client.ts on a 401. Returns false (and clears the stored
 * session) on any failure — an expired/revoked/invalid refresh token, a
 * deactivated account, or a network error — so the caller can surface the
 * original 401 and the next app-open routes back to /(auth)/login.
 */
export async function tryRefreshSession(): Promise<boolean> {
  const refreshToken = await getStoredRefreshToken();
  if (refreshToken === null) {
    return false;
  }

  try {
    const response = await fetch(`${env.API_URL}/api/auth/mobile/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      await clearSession();
      return false;
    }

    const pair = (await response.json()) as RefreshedTokenPair;
    await SecureStore.setItemAsync(AUTH_TOKEN_KEY, pair.token);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, pair.refreshToken);
    return true;
  } catch {
    // Network failure — don't clear the session, the token may still be
    // valid once connectivity returns; just fail this one refresh attempt.
    return false;
  }
}
