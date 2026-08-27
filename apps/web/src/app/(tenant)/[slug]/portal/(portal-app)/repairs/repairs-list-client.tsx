"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Wrench } from "@/components/ui/icons";
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
    <Badge variant="outline" className={`rounded-full ${statusClass}`}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

function deviceLabel(row: {
  deviceType: string | null;
  deviceBrand: string | null;
  deviceModel: string | null;
}) {
  const type = row.deviceType ?? "Device";
  const parts = [row.deviceBrand, row.deviceModel].filter(
    (p): p is string => p !== null && p.trim() !== "",
  );
  return parts.length > 0 ? `${type} — ${parts.join(" ")}` : type;
}

export function RepairsListClient() {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading } = trpc.portal.repairs.list.useQuery();

  if (isLoading) {
    return (
      <div className="space-y-2 rounded-lg border border-border p-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  const rows = data ?? [];

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <Wrench className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No repairs yet</p>
          <p className="text-sm text-muted-foreground">
            Your device repairs will show up here once one is created.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Job #</TableHead>
            <TableHead>Device</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} className="cursor-pointer">
              <TableCell className="p-0">
                <Link
                  href={`/${slug}/portal/repairs/${row.id}`}
                  className="block px-2 py-2 font-medium hover:underline"
                >
                  {row.jobOrderNumber}
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/${slug}/portal/repairs/${row.id}`} className="block">
                  {deviceLabel(row)}
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/${slug}/portal/repairs/${row.id}`} className="block">
                  <StatusBadge status={row.status} />
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/${slug}/portal/repairs/${row.id}`} className="block text-muted-foreground">
                  {new Intl.DateTimeFormat("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  }).format(new Date(row.createdAt))}
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
