import { middleware } from "../trpc";
import { rateLimiters } from "@/server/lib/rate-limit";
import type { TRPCContext } from "../context";

function getClientIp(req: TRPCContext["req"]): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export const withApiRateLimit = middleware(({ ctx, next }) => {
  const token = ctx.userId ?? getClientIp(ctx.req);
  rateLimiters.api.check(token);
  return next({ ctx });
});

export const withAuthRateLimit = middleware(({ ctx, next }) => {
  rateLimiters.auth.check(getClientIp(ctx.req));
  return next({ ctx });
});

export const withUploadRateLimit = middleware(({ ctx, next }) => {
  const token = ctx.userId ?? getClientIp(ctx.req);
  rateLimiters.upload.check(token);
  return next({ ctx });
});
