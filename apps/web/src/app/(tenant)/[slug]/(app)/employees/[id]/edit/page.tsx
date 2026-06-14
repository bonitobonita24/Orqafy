import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";
import { EmployeeForm } from "../../employee-form";

export const metadata: Metadata = { title: "Edit Employee" };
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string; id: string }>;
}

export default async function EditEmployeePage({ params }: Props) {
  const { slug, id } = await params;

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!tenant) notFound();

  const [employee, users, departments] = await Promise.all([
    prisma.employee.findFirst({
      where: { id, tenantId: tenant.id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            displayName: true,
            email: true,
          },
        },
      },
    }),
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

  if (employee === null) notFound();

  // Ensure the employee's own user is always selectable even if inactive.
  const userInList = users.some((u) => u.id === employee.userId);
  const allUsers = userInList
    ? users
    : [
        {
          id: employee.user.id,
          firstName: employee.user.firstName,
          lastName: employee.user.lastName,
          displayName: employee.user.displayName,
          email: employee.user.email,
        },
        ...users,
      ];

  // Convert DB types (Decimal, Date) to plain strings for the form.
  const dateHired = employee.dateHired.toISOString().split("T")[0];
  const baseSalary =
    employee.baseSalary !== null ? String(Number(employee.baseSalary)) : "";
  const dailyRate =
    employee.dailyRate !== null ? String(Number(employee.dailyRate)) : "";
  const hourlyRate =
    employee.hourlyRate !== null ? String(Number(employee.hourlyRate)) : "";

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/${slug}/employees/${id}`}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← Back to Employee
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Edit Employee</h1>
      </div>

      <EmployeeForm
        slug={slug}
        mode="edit"
        employeeId={employee.id}
        users={allUsers}
        departments={departments}
        initial={{
          userId: employee.userId,
          departmentId: employee.departmentId ?? undefined,
          position: employee.position ?? undefined,
          employmentType: employee.employmentType as
            | "full_time"
            | "part_time"
            | "contract"
            | "probationary",
          dateHired,
          baseSalary,
          dailyRate,
          hourlyRate,
          sssNumber: employee.sssNumber ?? undefined,
          philhealthNumber: employee.philhealthNumber ?? undefined,
          pagibigNumber: employee.pagibigNumber ?? undefined,
          tinNumber: employee.tinNumber ?? undefined,
          bankName: employee.bankName ?? undefined,
          bankAccountNumber: employee.bankAccountNumber ?? undefined,
          emergencyContactName: employee.emergencyContactName ?? undefined,
          emergencyContactPhone: employee.emergencyContactPhone ?? undefined,
        }}
      />
    </div>
  );
}
