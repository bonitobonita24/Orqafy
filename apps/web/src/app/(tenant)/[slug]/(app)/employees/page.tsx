import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Users } from "lucide-react";
import { prisma } from "@orqafy/db";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = { title: "Employees" };
export const dynamic = "force-dynamic";

function userDisplayName(
  u: { displayName: string | null; firstName: string; lastName: string } | null,
): string {
  if (u === null) return "—";
  return u.displayName ?? `${u.firstName} ${u.lastName}`.trim();
}

const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  full_time: "Full-Time",
  part_time: "Part-Time",
  contract: "Contract",
  probationary: "Probationary",
};

const TYPE_BADGE: Record<string, string> = {
  full_time: "border-primary/30 bg-primary/10 text-primary",
  part_time: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  contract: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  probationary: "border-purple-500/30 bg-purple-500/10 text-purple-400",
};

const TABS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "terminated", label: "Terminated" },
];

async function getTenantId(slug: string) {
  const t = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  return t?.id ?? null;
}

async function getEmployees(tenantId: string, filter: string) {
  const where =
    filter === "active"
      ? { tenantId, dateTerminated: null }
      : filter === "terminated"
        ? { tenantId, dateTerminated: { not: null } }
        : { tenantId };
  return prisma.employee.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      employeeNumber: true,
      position: true,
      employmentType: true,
      dateHired: true,
      dateTerminated: true,
      user: {
        select: { firstName: true, lastName: true, displayName: true, email: true },
      },
      department: { select: { name: true } },
    },
  });
}

export default async function EmployeesPage({
  params: routeParams,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ filter?: string }>;
}) {
  const { slug } = await routeParams;
  const params = await searchParams;
  const filter = params.filter ?? "all";
  const tenantId = await getTenantId(slug);
  if (tenantId === null) notFound();
  const employees = await getEmployees(tenantId, filter);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employees"
        description={`${employees.length} employee${employees.length === 1 ? "" : "s"}`}
        actions={
          <Button asChild>
            <Link href={`/${slug}/employees/new`}>+ New Employee</Link>
          </Button>
        }
      />

      <div className="flex flex-wrap gap-1 rounded-md border border-border bg-card p-1">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`?filter=${tab.key}`}
            className={`rounded px-3 py-1 text-sm transition-colors ${
              filter === tab.key
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {employees.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Users}
                title="No employees found."
                action={
                  <Button asChild>
                    <Link href={`/${slug}/employees/new`}>Create your first employee</Link>
                  </Button>
                }
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee #</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Hired</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <Link
                        href={`employees/${e.id}`}
                        className="font-mono text-xs font-medium text-primary hover:underline"
                      >
                        {e.employeeNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium">{userDisplayName(e.user)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {e.position ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {e.department?.name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`rounded-full ${
                          TYPE_BADGE[e.employmentType] ?? TYPE_BADGE["full_time"]
                        }`}
                      >
                        {EMPLOYMENT_TYPE_LABELS[e.employmentType] ?? e.employmentType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {e.dateHired.toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {e.dateTerminated !== null ? (
                        <Badge variant="outline" className="rounded-full border-red-500/30 bg-red-500/10 text-red-400">
                          Terminated
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="rounded-full border-primary/30 bg-primary/10 text-primary">
                          Active
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
