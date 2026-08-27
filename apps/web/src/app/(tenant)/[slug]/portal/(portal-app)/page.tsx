import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@orqafy/db";
import { auth } from "@/server/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Receipt, Package, Wrench } from "@/components/ui/icons";
import { ACTIVE_ORDER_STATUSES, OPEN_REPAIR_STATUSES } from "@/server/lib/portal-status";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ slug: string }>;
}

function formatPHP(n: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(n);
}

// Authed customer landing — greets the customer + shows a real, customer-scoped
// summary (counts + outstanding balance) computed with the SAME
// { tenantId, customerId } scoping as routers/portal.ts. Server-rendered
// direct queries (this page already reads the DB); never fabricated data.
export default async function PortalHomePage({ params }: PageProps) {
  const { slug } = await params;
  const session = await auth();

  // Defense-in-depth alongside middleware.ts's principal-isolation redirect —
  // this page must never render for a non-customer / invalidated session.
  if (
    session === null ||
    session.principalType !== "customer" ||
    session.customerId === undefined ||
    session.customerId === "" ||
    session.error === "SESSION_INVALIDATED"
  ) {
    redirect(`/${slug}/portal/login`);
  }

  const customerId = session.customerId;
  const tenantId = session.user.tenantId;
  // Every query is scoped to BOTH the session's tenant and customer — a portal
  // customer can only ever see their own totals.
  const scope = { tenantId, customerId };

  const [customer, invoiceCount, outstanding, orderCount, activeOrders, repairCount, openRepairs] =
    await Promise.all([
      prisma.customer.findUnique({
        where: { id: customerId },
        select: { firstName: true, lastName: true, companyName: true },
      }),
      prisma.invoice.count({ where: scope }),
      prisma.invoice.aggregate({ where: { ...scope, balance: { gt: 0 } }, _sum: { balance: true } }),
      prisma.ecommerceOrder.count({ where: scope }),
      prisma.ecommerceOrder.count({ where: { ...scope, status: { in: [...ACTIVE_ORDER_STATUSES] } } }),
      prisma.jobOrder.count({ where: scope }),
      prisma.jobOrder.count({ where: { ...scope, status: { in: [...OPEN_REPAIR_STATUSES] } } }),
    ]);

  const displayName =
    customer?.companyName ?? `${customer?.firstName ?? ""} ${customer?.lastName ?? ""}`.trim();
  const outstandingBalance = Number(outstanding._sum.balance ?? 0);

  const sections = [
    {
      label: "Invoices",
      href: "invoices",
      icon: Receipt,
      stat: `${invoiceCount}`,
      detail:
        outstandingBalance > 0
          ? `${formatPHP(outstandingBalance)} outstanding`
          : "All settled",
    },
    {
      label: "Orders",
      href: "orders",
      icon: Package,
      stat: `${orderCount}`,
      detail: `${activeOrders} active`,
    },
    {
      label: "Repairs",
      href: "repairs",
      icon: Wrench,
      stat: `${repairCount}`,
      detail: `${openRepairs} open`,
    },
  ] as const;

  return (
    <div data-fdl="portal-home" className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">
          Welcome{displayName !== "" ? `, ${displayName}` : ""}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here&apos;s a summary of your account.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {sections.map(({ label, href, icon: Icon, stat, detail }) => (
          <Link key={href} href={`/${slug}/portal/${href}`}>
            <Card className="h-full transition hover:border-primary/50 hover:shadow-sm">
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {label}
                </CardTitle>
                <Icon className="size-5 shrink-0 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">{stat}</p>
                <CardDescription className="mt-1">{detail}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
