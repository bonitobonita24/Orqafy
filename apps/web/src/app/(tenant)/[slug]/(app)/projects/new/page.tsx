import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";
import { ProjectForm } from "./project-form";

export const metadata: Metadata = { title: "New Project" };

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function NewProjectPage({ params }: Props) {
  const { slug } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!tenant) notFound();

  const customers = await prisma.customer.findMany({
    where: { isActive: true, tenantId: tenant.id },
    orderBy: { companyName: "asc" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      companyName: true,
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/${slug}/projects`}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← Projects
        </Link>
        <span className="text-xs text-muted-foreground">/</span>
        <span className="text-xs text-muted-foreground">New</span>
      </div>
      <h1 className="text-2xl font-bold tracking-tight">New Project</h1>
      <ProjectForm slug={slug} customers={customers} />
    </div>
  );
}
