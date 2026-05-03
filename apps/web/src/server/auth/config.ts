import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma as db } from "@orqafy/db";
import { env } from "@/env";

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
      async authorize(rawCredentials) {
        const parsed = loginSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const { email, password, tenantSlug } = parsed.data;

        // Demo tenant: fast-path auth check
        const isDemoTenant = tenantSlug === "demo";

        const tenant = await db.tenant.findUnique({
          where: { slug: tenantSlug },
          select: { id: true, isActive: true, slug: true },
        });
        if (tenant?.isActive !== true) return null;

        const user = await db.user.findFirst({
          where: { email, isActive: true },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            displayName: true,
            passwordHash: true,
            securityVersion: true,
            role: { select: { name: true } },
          },
        });
        if (user?.passwordHash === undefined || user.passwordHash === "") return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        const roles = [user.role.name];
        const displayName = user.displayName ?? `${user.firstName} ${user.lastName}`;

        return {
          id: user.id,
          email: user.email,
          name: displayName,
          roles,
          tenantSlug: tenant.slug,
          tenantId: tenant.id,
          securityVersion: user.securityVersion,
          isDemoTenant,
        };
      },
    }),
  ],
};
