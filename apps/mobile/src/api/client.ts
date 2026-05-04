import { QueryClient } from "@tanstack/react-query";
import * as SecureStore from "expo-secure-store";
import { env } from "@/env";
import { AUTH_TOKEN_KEY } from "@/constants";

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

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API error ${response.status}: ${body}`);
  }

  return response.json() as Promise<T>;
}
