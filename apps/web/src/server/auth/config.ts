import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { prisma as db } from "@orqafy/db";
import { env } from "@/env";
import { rateLimiters } from "@/server/lib/rate-limit";
import { verifyCredentials } from "@/server/auth/verify-credentials";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  tenantSlug: z.string().min(1),
});

export const authConfig: NextAuthConfig = {
  secret: env.AUTH_SECRET,
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user !== undefined) {
        token.userId = user.id;
        token.roles = (user as { roles?: string[] }).roles ?? [];
        token.roleId = (user as { roleId?: string }).roleId ?? "";
        token.tenantSlug = (user as { tenantSlug?: string }).tenantSlug ?? "";
        token.tenantId = (user as { tenantId?: string }).tenantId ?? "";
        token.securityVersion = (user as { securityVersion?: number }).securityVersion ?? 0;
        token.isDemoTenant = (user as { isDemoTenant?: boolean }).isDemoTenant ?? false;
      }
      return token;
    },
    async session({ session, token }) {
      // Re-validate securityVersion on each session to detect role/tenant/status changes
      if (token.userId !== undefined && token.userId !== null) {
        const dbUser = await db.user.findUnique({
          where: { id: token.userId as string },
          select: { securityVersion: true, isActive: true },
        });
        if (dbUser === null || dbUser.isActive !== true || dbUser.securityVersion !== token.securityVersion) {
          // Force sign-out by returning an invalid session shape
          return { ...session, error: "SESSION_INVALIDATED" };
        }
      }
      session.user.id = token.userId as string;
      session.user.roles = token.roles as string[];
      session.user.roleId = token.roleId as string;
      session.user.tenantSlug = token.tenantSlug as string;
      session.user.tenantId = token.tenantId as string;
      session.user.securityVersion = token.securityVersion as number;
      session.user.isDemoTenant = token.isDemoTenant as boolean;
      return session;
    },
  },
  providers: [
    Credentials({
      credentials: {
        email: { type: "email" },
        password: { type: "password" },
        tenantSlug: { type: "text" },
      },
      async authorize(rawCredentials, request) {
        const ip =
          request?.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          request?.headers?.get("x-real-ip") ??
          "unknown";
        try {
          rateLimiters.auth.check(ip);
        } catch {
          return null; // rate-limited: deny (opaque, no enumeration signal)
        }

        const parsed = loginSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        return verifyCredentials(parsed.data);
      },
    }),
  ],
};
