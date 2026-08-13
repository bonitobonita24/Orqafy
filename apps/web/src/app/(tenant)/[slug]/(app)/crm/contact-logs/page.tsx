import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageSquare } from "@/components/ui/icons";
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

export const metadata: Metadata = { title: "Contact logs" };

export const dynamic = "force-dynamic";

const CONTACT_LOG_TYPES = ["call", "email", "meeting", "note"] as const;
type ContactLogType = (typeof CONTACT_LOG_TYPES)[number];

const TYPE_COLORS: Record<ContactLogType, string> = {
  call: "text-sky-400 bg-sky-400/10 border-sky-400/30",
  email: "text-purple-400 bg-purple-400/10 border-purple-400/30",
  meeting: "text-primary bg-primary/10 border-primary/30",
  note: "text-muted-foreground bg-muted border-border",
};

const TYPE_LABELS: Record<ContactLogType, string> = {
  call: "Call",
  email: "Email",
  meeting: "Meeting",
  note: "Note",
};

const DEFAULT_LIMIT = 50;

function isType(value: string | undefined): value is ContactLogType {
  return (
    typeof value === "string" && (CONTACT_LOG_TYPES as readonly string[]).includes(value)
  );
}

function customerLabel(customer: {
  companyName: string | null;
  firstName: string;
  lastName: string;
} | null): string {
  if (customer === null) return "—";
  const company = customer.companyName?.trim();
  if (company !== undefined && company.length > 0) return company;
  return `${customer.firstName} ${customer.lastName}`;
}

function userLabel(user: {
  firstName: string;
  lastName: string;
  displayName: string | null;
} | null): string {
  if (user === null) return "—";
  const display = user.displayName?.trim();
  if (display !== undefined && display.length > 0) return display;
  return `${user.firstName} ${user.lastName}`;
}

function buildFilterHref(
  slug: string,
  params: { customerId?: string | undefined; type?: ContactLogType | undefined },
): string {
  const sp = new URLSearchParams();
  if (params.customerId !== undefined) sp.set("customerId", params.customerId);
  if (params.type !== undefined) sp.set("type", params.type);
  const qs = sp.toString();
  return qs.length > 0
    ? `/${slug}/crm/contact-logs?${qs}`
    : `/${slug}/crm/contact-logs`;
}

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ customerId?: string; type?: string; page?: string }>;
}

export default async function ContactLogsPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { customerId: rawCustomerId, type: rawType, page: rawPage } = await searchParams;
  const type = isType(rawType) ? rawType : undefined;
  const customerId =
    typeof rawCustomerId === "string" && rawCustomerId.length > 0 ? rawCustomerId : undefined;
  const parsedPage = typeof rawPage === "string" ? Number.parseInt(rawPage, 10) : 1;
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!tenant) notFound();

  const where = {
    tenantId: tenant.id,
    ...(customerId !== undefined ? { customerId } : {}),
    ...(type !== undefined ? { type } : {}),
  };

  const [items, total, customerForFilter] = await Promise.all([
    prisma.contactLog.findMany({
      where,
      orderBy: { occurredAt: "desc" },
      skip: (page - 1) * DEFAULT_LIMIT,
      take: DEFAULT_LIMIT,
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true, companyName: true },
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true, displayName: true },
        },
      },
    }),
    prisma.contactLog.count({ where }),
    customerId !== undefined
      ? prisma.customer.findFirst({
          where: { id: customerId, tenantId: tenant.id },
          select: { id: true, firstName: true, lastName: true, companyName: true },
        })
      : Promise.resolve(null),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / DEFAULT_LIMIT));
  const customerFilterLabel = customerForFilter !== null ? customerLabel(customerForFilter) : null;

  const prevHref = `${buildFilterHref(slug, { customerId, type })}${
    buildFilterHref(slug, { customerId, type }).includes("?") ? "&" : "?"
  }page=${page - 1}`;
  const nextHref = `${buildFilterHref(slug, { customerId, type })}${
    buildFilterHref(slug, { customerId, type }).includes("?") ? "&" : "?"
  }page=${page + 1}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contact logs"
        description={
          <>
            {items.length} of {total} {total === 1 ? "entry" : "entries"}
            {type !== undefined ? ` filtered by "${TYPE_LABELS[type]}"` : ""}
            {customerFilterLabel !== null ? ` for ${customerFilterLabel}` : ""}
          </>
        }
        actions={
          customerId !== undefined ? (
            <Button variant="outline" asChild>
              <Link href={`/${slug}/crm/customers/${customerId}`}>View customer</Link>
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap gap-2">
        <Link
          href={buildFilterHref(slug, { customerId })}
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            type === undefined
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-card text-muted-foreground hover:text-foreground"
          }`}
        >
          All types
        </Link>
        {CONTACT_LOG_TYPES.map((t) => (
          <Link
            key={t}
            href={buildFilterHref(slug, { customerId, type: t })}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              type === t
                ? TYPE_COLORS[t]
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {TYPE_LABELS[t]}
          </Link>
        ))}
        {customerId !== undefined ? (
          <Link
            href={buildFilterHref(slug, { type })}
            className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Clear customer filter
          </Link>
        ) : null}
      </div>

      <Card>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={MessageSquare}
                title={`No contact log entries${
                  type !== undefined ? ` of type "${TYPE_LABELS[type]}"` : ""
                }${customerFilterLabel !== null ? ` for ${customerFilterLabel}` : ""} yet.`}
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((log) => {
                  const typeKey = isType(log.type) ? log.type : "note";
                  const typeClass = TYPE_COLORS[typeKey];
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {log.occurredAt.toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`rounded-full ${typeClass}`}>
                          {TYPE_LABELS[typeKey]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {log.customer !== null ? (
                          <Link
                            href={`/${slug}/crm/customers/${log.customer.id}`}
                            className="text-primary hover:underline"
                          >
                            {customerLabel(log.customer)}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>{log.subject}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {userLabel(log.createdBy)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            {page > 1 ? (
              <Link
                href={prevHref}
                className="rounded-md border border-border bg-card px-3 py-1 hover:bg-muted"
              >
                Previous
              </Link>
            ) : null}
            {page < totalPages ? (
              <Link
                href={nextHref}
                className="rounded-md border border-border bg-card px-3 py-1 hover:bg-muted"
              >
                Next
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
