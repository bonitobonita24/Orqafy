import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";
import { JobOrderLineItems } from "./job-order-line-items";
import { JobOrderStatusActions } from "./job-order-status-actions";
import { SignaturePad } from "./signature-pad";

export const metadata: Metadata = { title: "Job Order" };

export const dynamic = "force-dynamic";

const LINE_ITEM_EDITABLE_STATUSES = new Set([
  "received",
  "diagnosing",
  "in_progress",
  "testing",
]);

const SIGNATURE_CAPTURABLE_STATUSES = new Set(["testing", "completed"]);

const STATUS_COLORS: Record<string, string> = {
  received: "text-sky-400 bg-sky-400/10 border-sky-400/30",
  diagnosing: "text-amber-400 bg-amber-400/10 border-amber-400/30",
  quoted: "text-purple-400 bg-purple-400/10 border-purple-400/30",
  approved: "text-primary bg-primary/10 border-primary/30",
  in_progress: "text-sky-400 bg-sky-400/10 border-sky-400/30",
  testing: "text-orange-400 bg-orange-400/10 border-orange-400/30",
  completed: "text-primary bg-primary/10 border-primary/30",
  released: "text-muted-foreground bg-muted border-border",
  cancelled: "text-red-400 bg-red-400/10 border-red-400/30",
};

function customerLabel(customer: {
  companyName: string | null;
  firstName: string;
  lastName: string;
}): string {
  const company = customer.companyName?.trim();
  if (company !== undefined && company.length > 0) return company;
  return `${customer.firstName} ${customer.lastName}`;
}

function userLabel(user: {
  firstName: string;
  lastName: string;
  displayName?: string | null;
} | null): string {
  if (user === null) return "Unassigned";
  const display = user.displayName?.trim();
  if (display !== undefined && display.length > 0) return display;
  return `${user.firstName} ${user.lastName}`;
}

interface PageProps {
  params: Promise<{ slug: string; id: string }>;
}

export default async function JobOrderDetailPage({ params }: PageProps) {
  const { slug, id } = await params;
  const jobOrder = await prisma.jobOrder.findUnique({
    where: { id },
    include: {
      customer: true,
      createdBy: { select: { firstName: true, lastName: true, displayName: true } },
      technician: { select: { firstName: true, lastName: true, displayName: true } },
      parts: { orderBy: { createdAt: "asc" } },
      serviceLines: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (jobOrder === null) notFound();

  const canEditLineItems = LINE_ITEM_EDITABLE_STATUSES.has(jobOrder.status);
  const canCaptureSignature = SIGNATURE_CAPTURABLE_STATUSES.has(jobOrder.status);
  const statusClass = STATUS_COLORS[jobOrder.status] ?? STATUS_COLORS.received;

  const parts = jobOrder.parts.map((p) => ({
    id: p.id,
    description: p.description,
    quantity: p.quantity.toString(),
    unitPrice: p.unitPrice.toString(),
    totalPrice: p.totalPrice.toString(),
    isFromInventory: p.isFromInventory,
  }));
  const serviceLines = jobOrder.serviceLines.map((s) => ({
    id: s.id,
    description: s.description,
    hours: s.hours === null ? null : s.hours.toString(),
    rate: s.rate === null ? null : s.rate.toString(),
    amount: s.amount.toString(),
  }));

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Link href={`/${slug}/job-orders`} className="hover:text-foreground">
            Job orders
          </Link>
          <span>/</span>
          <span className="text-foreground">{jobOrder.jobOrderNumber}</span>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {jobOrder.title}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span
                className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass}`}
              >
                {jobOrder.status.replace(/_/g, " ")}
              </span>
              <span>Priority: {jobOrder.priority}</span>
              <span>•</span>
              <span>Customer: {customerLabel(jobOrder.customer)}</span>
              <span>•</span>
              <span>Technician: {userLabel(jobOrder.technician)}</span>
            </div>
          </div>
          <JobOrderStatusActions
            jobOrderId={jobOrder.id}
            currentStatus={jobOrder.status as Parameters<typeof JobOrderStatusActions>[0]["currentStatus"]}
            hasCustomerSignature={jobOrder.customerSignatureUrl !== null}
            hasTechnicianSignature={jobOrder.technicianSignatureUrl !== null}
          />
        </div>
        {jobOrder.reportedIssue !== "" ? (
          <div className="rounded-md border border-border bg-card/40 p-3 text-sm">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Reported issue
            </div>
            <p className="mt-1 whitespace-pre-wrap text-foreground">{jobOrder.reportedIssue}</p>
          </div>
        ) : null}
        {jobOrder.diagnosis !== null && jobOrder.diagnosis.length > 0 ? (
          <div className="rounded-md border border-border bg-card/40 p-3 text-sm">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Diagnosis
            </div>
            <p className="mt-1 whitespace-pre-wrap text-foreground">{jobOrder.diagnosis}</p>
          </div>
        ) : null}
      </header>

      <JobOrderLineItems
        jobOrderId={jobOrder.id}
        parts={parts}
        serviceLines={serviceLines}
        canEdit={canEditLineItems}
        currency={jobOrder.currency}
      />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Signatures</h2>
          {jobOrder.signedAt !== null ? (
            <span className="text-xs text-muted-foreground">
              Sign-off completed {jobOrder.signedAt.toLocaleString()}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              {canCaptureSignature
                ? "Both parties must sign to allow release."
                : "Signatures unlock when status is testing or completed."}
            </span>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 rounded-md border border-border p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Customer
            </div>
            {jobOrder.customerSignatureUrl !== null ? (
              <img
                src={jobOrder.customerSignatureUrl}
                alt="Customer signature"
                className="h-32 w-full rounded border border-border bg-background object-contain"
              />
            ) : canCaptureSignature ? (
              <SignaturePad jobOrderId={jobOrder.id} role="customer" label="Customer" />
            ) : (
              <div className="flex h-32 items-center justify-center rounded border border-dashed border-border text-sm text-muted-foreground">
                Not yet captured
              </div>
            )}
          </div>
          <div className="space-y-2 rounded-md border border-border p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Technician
            </div>
            {jobOrder.technicianSignatureUrl !== null ? (
              <img
                src={jobOrder.technicianSignatureUrl}
                alt="Technician signature"
                className="h-32 w-full rounded border border-border bg-background object-contain"
              />
            ) : canCaptureSignature ? (
              <SignaturePad jobOrderId={jobOrder.id} role="technician" label="Technician" />
            ) : (
              <div className="flex h-32 items-center justify-center rounded border border-dashed border-border text-sm text-muted-foreground">
                Not yet captured
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
