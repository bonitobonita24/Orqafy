import type { Metadata } from "next";
import { guardPage } from "@/server/rbac/guard-page";
import { SmtpConfigForm } from "./smtp-config-form";

export const metadata: Metadata = { title: "SMTP settings" };

export default async function SmtpSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await guardPage(slug, "settings");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">SMTP configuration</h1>
        <p className="text-sm text-muted-foreground">
          Configure outbound email delivery for invoices and notifications. The password is
          encrypted at rest before storage and never returned to the browser.
        </p>
      </div>
      <SmtpConfigForm />
    </div>
  );
}
