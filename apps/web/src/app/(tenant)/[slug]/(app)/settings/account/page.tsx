import type { Metadata } from "next";
import { createServerCaller } from "@/server/trpc/server";
import { AccountForm } from "./account-form";

export const metadata: Metadata = { title: "Account settings" };

export const dynamic = "force-dynamic";

export default async function AccountSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await params; // resolve but we don't need slug — createServerCaller uses session tenant

  const api = await createServerCaller();
  const tenant = await api.tenant.current();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Account &amp; Tenant
        </h1>
        <p className="text-sm text-muted-foreground">
          General workspace info. Changes take effect immediately for all users.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card px-6 py-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Current workspace
        </p>
        <div className="flex flex-wrap gap-8 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Slug</p>
            <p className="font-mono">{tenant.slug}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <p>{tenant.isActive ? "Active" : "Inactive"}</p>
          </div>
        </div>
      </div>

      <AccountForm
        initialName={tenant.name}
        initialTimezone={tenant.timezone ?? ""}
        initialCurrency={tenant.currency ?? ""}
      />
    </div>
  );
}
