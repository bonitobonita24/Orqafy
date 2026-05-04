import * as SecureStore from "expo-secure-store";
import { AUTH_TOKEN_KEY, REFRESH_TOKEN_KEY, TENANT_ID_KEY } from "@/constants";

export interface AuthSession {
  token: string;
  refreshToken: string;
  tenantId: string;
  userId: string;
  roles: string[];
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

export async function getStoredTenantId(): Promise<string | null> {
  return SecureStore.getItemAsync(TENANT_ID_KEY);
}

export async function isAuthenticated(): Promise<boolean> {
  const token = await getStoredToken();
  return token !== null;
}
