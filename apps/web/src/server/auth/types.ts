import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      roles: string[];
      tenantSlug: string;
      tenantId: string;
      securityVersion: number;
      isDemoTenant: boolean;
      error?: string;
    } & DefaultSession["user"];
  }
}

