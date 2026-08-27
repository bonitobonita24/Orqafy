import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      roles: string[];
      roleId: string;
      tenantSlug: string;
      tenantId: string;
      securityVersion: number;
      isDemoTenant: boolean;
      error?: string;
    } & DefaultSession["user"];
    // Customer-portal principal (T1.2/T1.3) — set ONLY on a portal session,
    // additive to the staff `user` shape above which stays untouched.
    // "staff" is the default/omitted case (existing sessions).
    principalType?: "staff" | "customer";
    customerId?: string;
    customerSecurityVersion?: number;
    error?: string;
  }
}

// NOTE: no `declare module "next-auth/jwt"` augmentation — that subpath
// isn't resolvable under this next-auth v5 beta's package exports (the
// pre-existing codebase already reads/writes `token.*` via `as` casts in
// config.ts rather than a typed JWT interface; the portal branch follows
// the same convention).
