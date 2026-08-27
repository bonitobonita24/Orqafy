import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { prisma as db } from "@orqafy/db";
import { env } from "@/env";
import { rateLimiters } from "@/server/lib/rate-limit";
import { verifyCredentials } from "@/server/auth/verify-credentials";
import { verifyPortalCredentials } from "@/server/auth/verify-portal-credentials";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  tenantSlug: z.string().min(1),
});

const portalLoginSchema = z.object({
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
    async jwt({ token, user }) {
      if (user !== undefined) {
        const principalType = (user as { principalType?: string }).principalType ?? "staff";
        token.principalType = principalType;

        if (principalType === "customer") {
          token.customerId = (user as { customerId?: string }).customerId ?? "";
          token.tenantSlug = (user as { tenantSlug?: string }).tenantSlug ?? "";
          token.tenantId = (user as { tenantId?: string }).tenantId ?? "";
          token.customerSecurityVersion =
            (user as { customerSecurityVersion?: number }).customerSecurityVersion ?? 0;
          delete token.error;
          return token;
        }

        // Staff sign-in — UNCHANGED from the pre-portal behavior.
        token.userId = user.id;
        token.roles = (user as { roles?: string[] }).roles ?? [];
        token.roleId = (user as { roleId?: string }).roleId ?? "";
        token.tenantSlug = (user as { tenantSlug?: string }).tenantSlug ?? "";
        token.tenantId = (user as { tenantId?: string }).tenantId ?? "";
        token.securityVersion = (user as { securityVersion?: number }).securityVersion ?? 0;
        token.isDemoTenant = (user as { isDemoTenant?: boolean }).isDemoTenant ?? false;
        return token;
      }

      // Subsequent calls (no `user` — token already minted). The staff
      // principal is UNCHANGED: it does no DB work here, re-validation for
      // staff happens in the `session` callback exactly as before. Only the
      // customer principal is re-validated on this path, since a portal
      // session has no equivalent `session`-callback branch to reuse.
      if (
        token.principalType === "customer" &&
        token.customerId !== undefined &&
        (token.customerId as string) !== ""
      ) {
        const dbCustomer = await db.customer.findUnique({
          where: { id: token.customerId as string },
          select: { isActive: true, portalEnabled: true, customerSecurityVersion: true },
        });
        if (
          dbCustomer === null ||
          dbCustomer.isActive !== true ||
          dbCustomer.portalEnabled !== true ||
          dbCustomer.customerSecurityVersion !== (token.customerSecurityVersion as number)
        ) {
          token.error = "SESSION_INVALIDATED";
        } else {
          delete token.error;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token.principalType === "customer") {
        if (token.error === "SESSION_INVALIDATED") {
          // Carry principalType so a revoked customer session still routes
          // through the customer branch downstream (defense-in-depth alongside
          // the top-level session.error guard in trpc/context.ts + middleware).
          return {
            ...session,
            principalType: "customer" as const,
            error: "SESSION_INVALIDATED",
          };
        }
        // Customer session — deliberately does NOT look like a staff
        // session: empty roles, no roleId, no staff `id`.
        session.user.id = "";
        session.user.roles = [];
        session.user.roleId = "";
        session.user.tenantSlug = (token.tenantSlug as string) ?? "";
        session.user.tenantId = (token.tenantId as string) ?? "";
        session.user.securityVersion = 0;
        session.user.isDemoTenant = false;
        session.principalType = "customer";
        session.customerId = token.customerId as string;
        session.customerSecurityVersion = token.customerSecurityVersion as number;
        return session;
      }

      // Staff session — UNCHANGED. Re-validate securityVersion on each
      // session to detect role/tenant/status changes.
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
      session.principalType = "staff";
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
      id: "credentials",
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
    Credentials({
      id: "portal",
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

        const parsed = portalLoginSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const verified = await verifyPortalCredentials(parsed.data);
        if (verified === null) return null;

        // Deliberately does NOT carry roleId/roles/a staff `id` — must not
        // be mistaken for a staff user by protectedProcedure/matrixProcedure.
        return {
          id: `customer:${verified.customerId}`,
          principalType: "customer" as const,
          customerId: verified.customerId,
          tenantId: verified.tenantId,
          tenantSlug: verified.tenantSlug,
          customerSecurityVersion: verified.customerSecurityVersion,
          email: verified.email,
        };
      },
    }),
  ],
};
