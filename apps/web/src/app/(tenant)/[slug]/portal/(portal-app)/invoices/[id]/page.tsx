import type { Metadata } from "next";
import { InvoiceDetailClient } from "./invoice-detail-client";

export const metadata: Metadata = {
  title: "Invoice",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ slug: string; id: string }>;
}

export default async function PortalInvoiceDetailPage({ params }: PageProps) {
  const { slug, id } = await params;
  return <InvoiceDetailClient slug={slug} id={id} />;
}
