import type { Metadata } from "next";
import { XenditConfigForm } from "./config-form";

export const metadata: Metadata = { title: "Xendit settings" };

export default function XenditSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Xendit configuration
        </h1>
        <p className="text-sm text-muted-foreground">
          Connect your Xendit account to accept online payments for ecommerce
          orders. Secrets are encrypted at rest before storage and never returned
          to the browser.
        </p>
      </div>
      <XenditConfigForm />
    </div>
  );
}
