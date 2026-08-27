"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, Wrench } from "@/components/ui/icons";
import { trpc } from "@/lib/trpc";

// Same status→color mapping as the staff job-order detail page
// ((app)/service/job-orders/[id]/page.tsx STATUS_COLORS) — kept in sync so a
// status reads the same badge color for customer and staff.
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

function StatusBadge({ status }: { status: string }) {
  const statusClass = STATUS_COLORS[status] ?? STATUS_COLORS.received;
  return (
    <Badge variant="outline" className={`rounded-full text-sm ${statusClass}`}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

// `value` is typed as the Prisma Decimal at compile time (client-side it's
// really a superjson-serialized string, but the tRPC-inferred type still
// reflects the server return type) — accept both and stringify defensively.
function formatMoney(value: { toString(): string } | string | null, currency: string): string {
  if (value === null) return "—";
  const n = Number(value.toString());
  if (!Number.isFinite(n)) return "—";
  return `${currency} ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value: Date | string | null): string {
  if (value === null) return "—";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

interface RepairDetailClientProps {
  slug: string;
  id: string;
}

export function RepairDetailClient({ slug, id }: RepairDetailClientProps) {
  const backLink = (
    <Link
      href={`/${slug}/portal/repairs`}
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ChevronLeft className="size-3.5" />
      Back to repairs
    </Link>
  );

  const { data, isLoading, error } = trpc.portal.repairs.byId.useQuery(
    { id },
    { retry: false },
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        {backLink}
        <div className="space-y-2 rounded-lg border border-border p-4">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  // NOT_FOUND is the expected shape for someone else's/nonexistent job id
  // (portal.ts's repairsRouter.byId — enumeration-resistant, never FORBIDDEN).
  // Any other error also lands here as a friendly state rather than a crash.
  if (error !== null || data === undefined) {
    return (
      <div className="space-y-6">
        {backLink}
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Wrench className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">Repair not found</p>
            <p className="text-sm text-muted-foreground">
              This repair doesn&apos;t exist or isn&apos;t associated with your account.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const deviceParts = [data.deviceBrand, data.deviceModel].filter(
    (p): p is string => p !== null && p.trim() !== "",
  );
  const deviceLine = deviceParts.length > 0 ? deviceParts.join(" ") : null;

  return (
    <div className="space-y-6">
      {backLink}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{data.jobOrderNumber}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.deviceType ?? "Device"}
            {deviceLine !== null ? ` — ${deviceLine}` : ""}
          </p>
        </div>
        <StatusBadge status={data.status} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Device</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground">Type</p>
            <p>{data.deviceType ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Brand / Model</p>
            <p>{deviceLine ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Serial number</p>
            <p>{data.serialNumber ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Priority</p>
            <p className="capitalize">{data.priority}</p>
          </div>
          {data.reportedIssue !== "" && (
            <div className="sm:col-span-2">
              <p className="text-muted-foreground">Reported issue</p>
              <p className="whitespace-pre-wrap">{data.reportedIssue}</p>
            </div>
          )}
          {data.diagnosis !== null && data.diagnosis !== "" && (
            <div className="sm:col-span-2">
              <p className="text-muted-foreground">Diagnosis</p>
              <p className="whitespace-pre-wrap">{data.diagnosis}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {(data.parts.length > 0 || data.serviceLines.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Parts &amp; service</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {data.parts.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Parts
                </p>
                {data.parts.map((part) => (
                  <div key={part.id} className="flex items-center justify-between border-b border-border/60 py-1.5 last:border-0">
                    <span>
                      {part.description}{" "}
                      <span className="text-muted-foreground">× {part.quantity.toString()}</span>
                    </span>
                    <span className="text-muted-foreground">{formatMoney(part.totalPrice, data.currency)}</span>
                  </div>
                ))}
              </div>
            )}
            {data.serviceLines.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Service
                </p>
                {data.serviceLines.map((line) => (
                  <div key={line.id} className="flex items-center justify-between border-b border-border/60 py-1.5 last:border-0">
                    <span>{line.description}</span>
                    <span className="text-muted-foreground">{formatMoney(line.amount, data.currency)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cost &amp; dates</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground">Estimated cost</p>
            <p>{formatMoney(data.estimatedCost, data.currency)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Actual cost</p>
            <p>{formatMoney(data.actualCost, data.currency)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Warranty</p>
            <p>{data.warranty ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Received</p>
            <p>{formatDate(data.createdAt)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Completed</p>
            <p>{formatDate(data.completedAt)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Released</p>
            <p>{formatDate(data.releasedAt)}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
