/**
 * Tenant DSR self-service page — V32.9 / RA 10173
 * Server shell; heavy lifting in privacy-client.tsx (client component).
 */
import type { Metadata } from "next";
import { PrivacyClient } from "./privacy-client";

export const metadata: Metadata = { title: "Privacy & My Data" };

export const dynamic = "force-dynamic";

export default async function TenantPrivacyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await params; // resolve per Next 15 pattern; slug not needed (session owns tenant)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Privacy &amp; My Data</h1>
        <p className="text-sm text-muted-foreground">
          Exercise your rights under the Philippine Data Privacy Act (RA 10173). View, correct,
          export, or request deletion of your personal data.
        </p>
      </div>

      <PrivacyClient />
    </div>
  );
}
