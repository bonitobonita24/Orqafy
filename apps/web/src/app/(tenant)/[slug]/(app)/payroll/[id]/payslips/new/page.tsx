import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";
import { PayslipForm } from "../../payslip-form";

export const metadata: Metadata = { title: "Add Payslip" };
export const dynamic = "force-dynamic";

export default async function AddPayslipPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;

  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (tenant === null) notFound();
  const payroll = await prisma.payroll.findFirst({
    where: { id, tenantId: tenant.id },
    select: { id: true, payrollNumber: true, status: true, currency: true },
  });
  if (payroll === null) notFound();

  if (payroll.status !== "draft") {
    return (
      <div className="space-y-4">
        <Link
          href={`/${slug}/payroll/${id}`}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← Back to Payroll Run
        </Link>
        <p className="rounded border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
          Payslips can only be added to <strong>draft</strong> payroll runs. This run is currently{" "}
          <strong>{payroll.status}</strong>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/${slug}/payroll/${id}`}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← Back to {payroll.payrollNumber}
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Add Payslip</h1>
        <p className="text-sm text-muted-foreground">
          Manually enter amounts for this employee on run{" "}
          <span className="font-mono text-xs">{payroll.payrollNumber}</span>.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <PayslipForm slug={slug} payrollId={id} currency={payroll.currency} />
      </div>
    </div>
  );
}
