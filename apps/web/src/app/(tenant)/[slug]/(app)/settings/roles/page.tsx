import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { guardPage } from "@/server/rbac/guard-page";
import { auth } from "@/server/auth";
import { RolesClient } from "./roles-client";

export const metadata: Metadata = { title: "Roles & Permissions" };

export const dynamic = "force-dynamic";

export default async function RolesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await guardPage(slug, "settings");

  // Custom-role management is Tenant Super Admin / Platform Owner only
  // (tenant-rbac-standard.md §4 guardrails) — defense-in-depth over the
  // server mutations (`superAdminProcedure` in the `role` router).
  const session = await auth();
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("Tenant Super Admin") && !roles.includes("Platform Owner")) {
    redirect(`/${slug}/settings`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Roles &amp; Permissions</h1>
        <p className="text-sm text-muted-foreground">
          Create custom roles and set feature permissions. Custom roles can never exceed the
          Admin role&apos;s ceiling, and can never be granted Users or Billing.
        </p>
      </div>
      <RolesClient />
    </div>
  );
}
