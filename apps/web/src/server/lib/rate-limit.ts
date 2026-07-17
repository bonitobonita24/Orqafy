import { LRUCache } from "lru-cache";
import { TRPCError } from "@trpc/server";

type Options = {
  uniqueTokenPerInterval?: number;
  interval?: number;
  limit?: number;
};

function rateLimit(options?: Options) {
  const tokenCache = new LRUCache<string, number[]>({
    max: options?.uniqueTokenPerInterval ?? 500,
    ttl: options?.interval ?? 60_000,
  });

  return {
    check: (token: string, limitOverride?: number) => {
      const maxRequests = limitOverride ?? options?.limit ?? 60;
      const tokenCount = tokenCache.get(token) ?? [];
      const now = Date.now();
      const windowStart = now - (options?.interval ?? 60_000);
      const requestsInWindow = tokenCount.filter((t) => t > windowStart);

      if (requestsInWindow.length >= maxRequests) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Rate limit exceeded. Try again later.",
        });
      }

      tokenCache.set(token, [...requestsInWindow, now]);
    },
  };
}

// 9 named tiers matching inputs.yml rate_limiting config
export const rateLimiters = {
  // Unauthenticated public pages — 10/min per IP
  public: rateLimit({ interval: 60_000, limit: 10 }),
  // Authenticated API — 120/min per (tenantSlug+userId)
  api: rateLimit({ interval: 60_000, limit: 120 }),
  // File upload — 20/min per user
  upload: rateLimit({ interval: 60_000, limit: 20 }),
  // Media proxy download (/api/media) — 120/min per user
  mediaDownload: rateLimit({ interval: 60_000, limit: 120 }),
  // Mobile sync — 60/min per user
  mobile_sync: rateLimit({ interval: 60_000, limit: 60 }),
  // Public invoice page (no auth) — 30/min per IP
  public_invoice: rateLimit({ interval: 60_000, limit: 30 }),
  // Invoice signature submission — 5/min per IP per token
  invoice_signature: rateLimit({ interval: 60_000, limit: 5 }),
  // Demo auto-login — 30/min per IP
  demo_login: rateLimit({ interval: 60_000, limit: 30 }),
  // Demo role switcher — 60/min per IP
  demo_role_switch: rateLimit({ interval: 60_000, limit: 60 }),
  // Auth endpoints (login, register, forgot-password) — strict 10/min per IP
  auth: rateLimit({ interval: 60_000, limit: 10 }),
};
