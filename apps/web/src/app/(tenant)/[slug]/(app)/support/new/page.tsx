import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";
import { PageHeader } from "@/components/layout/page-header";
import { NewTicketForm } from "./new-ticket-form";

export const metadata: Metadata = { title: "New Support Ticket" };
export const dynamic = "force-dynamic";

export default async function NewSupportTicketPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (tenant === null) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/${slug}/support`}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ← All tickets
        </Link>
      </div>
      <PageHeader
        title="New Support Ticket"
        description="Describe your issue and we'll track it to resolution."
      />
      <NewTicketForm slug={slug} />
    </div>
  );
}
