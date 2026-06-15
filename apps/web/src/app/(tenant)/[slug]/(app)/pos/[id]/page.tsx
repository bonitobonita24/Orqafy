import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";
import { CloseSessionDialog } from "./close-session-dialog";
import { VoidSaleAction } from "./void-sale-action";

export const metadata: Metadata = { title: "POS Session Detail" };
export const dynamic = "force-dynamic";

function formatAmount(amount: unknown): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(Number(amount));
}

function formatDateTime(date: Date | null | undefined): string {
  if (date === null || date === undefined) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

function userDisplayName(u: {
  firstName: string;
  lastName: string;
  displayName: string | null;
}): string {
  return u.displayName ?? `${u.firstName} ${u.lastName}`.trim();
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Cash",
  gcash: "GCash",
  maya: "Maya",
  card: "Card",
  credit: "Credit",
};

export default async function POSSessionDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;

  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) notFound();

  const session = await prisma.pOSSession.findUnique({
    where: { id },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, displayName: true },
      },
      sales: {
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { items: true } } },
      },
    },
  });

  // tenant-scoped: prevents cross-tenant data leak
  if (session === null || session.tenantId !== tenant!.id) {
    notFound();
  }

  // Sales summary by payment method (completed only).
  const completedSales = session.sales.filter((s) => s.status === "completed");
  const totalRevenue = completedSales.reduce(
    (sum, s) => sum + Number(s.totalAmount),
    0,
  );
  const cashSales = completedSales
    .filter((s) => s.paymentMethod === "cash")
    .reduce((sum, s) => sum + Number(s.totalAmount), 0);

  const voidedCount = session.sales.filter((s) => s.status === "voided").length;
  const isOpen = session.status === "open";

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/${slug}/pos`}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← All Sessions
        </Link>
        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {session.sessionNumber}
            </h1>
            {isOpen ? (
              <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                Open
              </span>
            ) : (
              <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                Closed
              </span>
            )}
          </div>
          {isOpen && <CloseSessionDialog sessionId={session.id} />}
        </div>
      </div>

      {/* Session metadata grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Stat label="Cashier" value={userDisplayName(session.user)} />
        <Stat label="Opened" value={formatDateTime(session.openedAt)} />
        <Stat label="Closed" value={formatDateTime(session.closedAt)} />
        <Stat
          label="Sales (Completed)"
          value={`${completedSales.length} of ${session.sales.length}`}
        />
      </div>

      {/* Cash drawer summary */}
      <section className="rounded-lg border border-border bg-card">
        <header className="border-b border-border px-6 py-4">
          <h2 className="text-sm font-semibold">Cash Drawer</h2>
        </header>
        <div className="grid grid-cols-1 gap-4 px-6 py-5 md:grid-cols-3 lg:grid-cols-6">
          <DrawerStat label="Opening" value={formatAmount(session.openingBalance)} />
          <DrawerStat
            label="Cash Sales"
            value={formatAmount(cashSales)}
            accent={!isOpen}
          />
          <DrawerStat
            label="Expected"
            value={
              session.expectedBalance !== null
                ? formatAmount(session.expectedBalance)
                : formatAmount(Number(session.openingBalance) + cashSales)
            }
          />
          <DrawerStat
            label="Closing"
            value={
              session.closingBalance !== null
                ? formatAmount(session.closingBalance)
                : "—"
            }
          />
          <DrawerStat
            label="Discrepancy"
            value={
              session.discrepancy !== null
                ? formatAmount(session.discrepancy)
                : "—"
            }
            danger={
              session.discrepancy !== null && Number(session.discrepancy) !== 0
            }
          />
          <DrawerStat
            label="Total Revenue"
            value={formatAmount(totalRevenue)}
            accent
          />
        </div>
      </section>

      {/* Sales table */}
      <section className="rounded-lg border border-border bg-card">
        <header className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-sm font-semibold">Sales</h2>
          {voidedCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {voidedCount} voided
            </span>
          )}
        </header>
        {session.sales.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-muted-foreground">
            No sales recorded in this session yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Sale #</th>
                <th className="px-4 py-2 font-medium">Time</th>
                <th className="px-4 py-2 text-right font-medium">Items</th>
                <th className="px-4 py-2 text-right font-medium">Subtotal</th>
                <th className="px-4 py-2 text-right font-medium">Tax</th>
                <th className="px-4 py-2 text-right font-medium">Discount</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
                <th className="px-4 py-2 font-medium">Method</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {session.sales.map((s) => (
                <tr
                  key={s.id}
                  className={`border-b border-border last:border-0 transition-colors hover:bg-muted/30 ${
                    s.status !== "completed" ? "opacity-60" : ""
                  }`}
                >
                  <td className="px-4 py-2 font-mono text-xs font-medium">
                    {s.saleNumber}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {formatDateTime(s.createdAt)}
                  </td>
                  <td className="px-4 py-2 text-right text-muted-foreground">
                    {s._count.items}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-xs">
                    {formatAmount(s.subtotal)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-xs text-muted-foreground">
                    {formatAmount(s.taxAmount)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-xs text-muted-foreground">
                    {formatAmount(s.discountAmount)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-xs font-medium">
                    {formatAmount(s.totalAmount)}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {PAYMENT_LABELS[s.paymentMethod] ?? s.paymentMethod}
                  </td>
                  <td className="px-4 py-2">
                    <SaleStatus status={s.status} />
                  </td>
                  <td className="px-4 py-2">
                    {s.status === "completed" && isOpen && (
                      <VoidSaleAction
                        saleId={s.id}
                        saleNumber={s.saleNumber}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {session.notes !== null && (
        <section className="rounded-lg border border-border bg-card px-6 py-4">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Notes
          </h3>
          <p className="mt-2 whitespace-pre-wrap text-sm">{session.notes}</p>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-5 py-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}

function DrawerStat({
  label,
  value,
  accent = false,
  danger = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
  danger?: boolean;
}) {
  const cls = danger
    ? "text-red-500"
    : accent
      ? "text-primary"
      : "text-foreground";
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 font-mono text-sm font-semibold ${cls}`}>{value}</div>
    </div>
  );
}

function SaleStatus({ status }: { status: string }) {
  if (status === "completed") {
    return (
      <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
        Completed
      </span>
    );
  }
  if (status === "voided") {
    return (
      <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-500">
        Voided
      </span>
    );
  }
  return (
    <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      {status}
    </span>
  );
}
