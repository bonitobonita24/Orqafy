import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";
import { PageHeader } from "@/components/layout/page-header";
import { ProjectEditForm } from "./project-edit-form";

export const metadata: Metadata = { title: "Edit Project" };
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string; id: string }>;
}

export default async function EditProjectPage({ params }: Props) {
  const { slug, id } = await params;

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!tenant) notFound();

  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      id: true,
      tenantId: true,
      name: true,
      customerId: true,
      description: true,
      status: true,
      startDate: true,
      targetEndDate: true,
      budget: true,
    },
  });
  if (!project || project.tenantId !== tenant.id) notFound();

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
        <Link
          href={`/${slug}/projects/${id}`}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {project.name}
        </Link>
        <span className="text-xs text-muted-foreground">/</span>
        <span className="text-xs text-muted-foreground">Edit</span>
      </div>
      <PageHeader title="Edit Project" />
      <ProjectEditForm
        slug={slug}
        projectId={id}
        customers={customers}
        initial={project}
      />
    </div>
  );
}
