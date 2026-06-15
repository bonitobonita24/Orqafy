import type { Metadata } from "next";
import { SmtpConfigForm } from "./smtp-config-form";

export const metadata: Metadata = { title: "SMTP settings" };

export default function SmtpSettingsPage() {
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
