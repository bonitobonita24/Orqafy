import type { Metadata } from "next";
import { InvoicesListClient } from "./invoices-list-client";

// Authed customer-portal page — carries the customer's own invoice PII,
// must never be indexed (same posture as the rest of the portal shell).
export const metadata: Metadata = {
  title: "Invoices",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function PortalInvoicesPage({ params }: PageProps) {
  const { slug } = await params;
  return <InvoicesListClient slug={slug} />;
}
