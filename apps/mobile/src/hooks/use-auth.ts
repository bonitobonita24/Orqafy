import { useState, useEffect, useCallback } from "react";
import { router } from "expo-router";
import {
  type AuthSession,
  saveSession,
  clearSession,
  getStoredToken,
  getStoredRefreshToken,
  isAuthenticated as checkAuth,
} from "@/lib/auth";
import { apiFetch } from "@/api";

interface UseAuthReturn {
  isLoading: boolean;
  isLoggedIn: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    void checkAuth().then((authenticated) => {
      setIsLoggedIn(authenticated);
      setIsLoading(false);
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const session = await apiFetch<AuthSession>("/api/auth/mobile/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      await saveSession(session);
      setIsLoggedIn(true);
      router.replace("/(app)/");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    const token = await getStoredToken();
    const refreshToken = await getStoredRefreshToken();
    if (token !== null && refreshToken !== null) {
      try {
        // Body is required: POST /api/auth/mobile/logout revokes THIS
        // refresh token's jti — see apps/web/.../mobile/logout/route.ts.
        await apiFetch("/api/auth/mobile/logout", {
          method: "POST",
          body: JSON.stringify({ refreshToken }),
        });
      } catch {
        // Best-effort server logout — clear local state regardless
      }
    }
    await clearSession();
    setIsLoggedIn(false);
    router.replace("/(auth)/login");
  }, []);

  return { isLoading, isLoggedIn, login, logout };
}
