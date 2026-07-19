import { QueryClient } from "@tanstack/react-query";
import * as SecureStore from "expo-secure-store";
import { env } from "@/env";
import { AUTH_TOKEN_KEY } from "@/constants";
import { tryRefreshSession } from "@/lib/auth";

// Endpoints that must never trigger a refresh-and-retry — a 401 from these
// IS the "you're logged out" answer (retrying with a refreshed token would
// either loop pointlessly or, for /refresh itself, be nonsensical).
const NO_REFRESH_PATHS = [
  "/api/auth/mobile/login",
  "/api/auth/mobile/refresh",
];

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30_000,
      gcTime: 5 * 60_000,
    },
    mutations: {
      retry: 1,
    },
  },
});

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
  if (token === null) {
    return {};
  }
  return { Authorization: `Bearer ${token}` };
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  _isRetry = false,
): Promise<T> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${env.API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...headers,
      ...options.headers,
    },
  });

  if (
    response.status === 401 &&
    !_isRetry &&
    !NO_REFRESH_PATHS.includes(path)
  ) {
    const refreshed = await tryRefreshSession();
    if (refreshed) {
      return apiFetch<T>(path, options, true);
    }
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API error ${response.status}: ${body}`);
  }

  return response.json() as Promise<T>;
}
