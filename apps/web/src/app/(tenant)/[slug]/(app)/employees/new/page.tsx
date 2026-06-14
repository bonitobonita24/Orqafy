import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";
import { EmployeeForm } from "../employee-form";

export const metadata: Metadata = { title: "New Employee" };
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function NewEmployeePage({ params }: Props) {
  const { slug } = await params;

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!tenant) notFound();

  const [users, departments] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId: tenant.id, isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        displayName: true,
        email: true,
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    prisma.department.findMany({
      where: { tenantId: tenant.id, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/${slug}/employees`}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← Employees
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">New Employee</h1>
        <p className="text-sm text-muted-foreground">
          Link an existing user account and fill in employment details.
        </p>
      </div>

      <EmployeeForm
        slug={slug}
        mode="create"
        users={users}
        departments={departments}
      />
    </div>
  );
}
