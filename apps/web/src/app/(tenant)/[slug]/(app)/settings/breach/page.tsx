/**
 * Data Breach Register — V32.9 / RA 10173
 * Admin page. Backend enforces requireRole; non-admins see a tRPC FORBIDDEN error
 * surfaced gracefully by the client component.
 */
import type { Metadata } from "next";
import { guardPage } from "@/server/rbac/guard-page";
import { BreachClient } from "./breach-client";

export const metadata: Metadata = { title: "Data Breach Register" };

export const dynamic = "force-dynamic";

export default async function BreachRegisterPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await guardPage(slug, "compliance");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Data Breach Register</h1>
        <p className="text-sm text-muted-foreground">
          Record and track data breaches per RA 10173 Section 20. NPC must be notified within 72
          hours of discovery; a full report is due within 5 business days.
        </p>
      </div>

      <BreachClient />
    </div>
  );
}
