import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "../trpc";
import { env } from "@/env";

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const resp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret: env.TURNSTILE_SECRET_KEY,
      response: token,
      remoteip: ip,
    }),
  });
  const data = (await resp.json()) as { success: boolean };
  return data.success;
}

export const authRouter = createTRPCRouter({
  verifyTurnstile: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const ip =
        ctx.req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        ctx.req.headers.get("x-real-ip") ??
        "unknown";
      const valid = await verifyTurnstile(input.token, ip);
      if (!valid) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Invalid bot protection token." });
      }
      return { success: true };
    }),

  me: protectedProcedure.query(({ ctx }) => ({
    userId: ctx.userId,
    roles: ctx.roles,
    tenantSlug: ctx.tenantSlug,
    isDemoTenant: ctx.isDemoTenant,
  })),
});
