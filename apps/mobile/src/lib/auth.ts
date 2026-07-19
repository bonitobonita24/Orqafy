import * as SecureStore from "expo-secure-store";
import { AUTH_TOKEN_KEY, REFRESH_TOKEN_KEY, TENANT_ID_KEY } from "@/constants";
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

export async function isAuthenticated(): Promise<boolean> {
  const token = await getStoredToken();
  return token !== null;
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
