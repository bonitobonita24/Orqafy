import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@orqafy/db";

export const metadata: Metadata = { title: "New POS Sale" };
export const dynamic = "force-dynamic";

function formatAmount(amount: unknown): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(Number(amount));
}

function userDisplayName(u: {
  firstName: string;
  lastName: string;
  displayName: string | null;
}): string {
  return u.displayName ?? `${u.firstName} ${u.lastName}`.trim();
}

export default async function POSNewSalePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Show all currently open sessions so the cashier can pick which to ring against.
  // (Once interactive cart is wired, this becomes a session picker.)
  const [openSessions, recentProducts] = await Promise.all([
    prisma.pOSSession.findMany({
      where: { status: "open" },
      orderBy: { openedAt: "desc" },
      take: 10,
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, displayName: true },
        },
        _count: { select: { sales: true } },
      },
    }),
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      take: 20,
      select: {
        id: true,
        sku: true,
        name: true,
        unit: true,
        tier1Price: true,
        baseCost: true,
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/${slug}/pos`}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← POS Sessions
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">New Sale</h1>
        <p className="text-sm text-muted-foreground">
          Ring up products and accept payment. Interactive cart UI lands in
          Phase 2 — backend tRPC (<code className="font-mono text-[#00d992]">pos.sale.create</code>)
          is live and atomic.
        </p>
      </div>

      {/* Open sessions to ring against */}
      <section className="rounded-lg border border-border bg-card">
        <header className="border-b border-border px-6 py-4">
          <h2 className="text-sm font-semibold">Open Sessions</h2>
          <p className="text-xs text-muted-foreground">
            Sales attach to an open cash drawer session. Select one to ring against.
          </p>
        </header>
        {openSessions.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-muted-foreground">
            No open sessions. Open a session first via{" "}
            <code className="font-mono text-[#00d992]">pos.session.open</code>.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Session</th>
                <th className="px-4 py-2 font-medium">Cashier</th>
                <th className="px-4 py-2 text-right font-medium">Opening</th>
                <th className="px-4 py-2 text-right font-medium">Sales</th>
              </tr>
            </thead>
            <tbody>
              {openSessions.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-border last:border-0 transition-colors hover:bg-muted/30"
                >
                  <td className="px-4 py-2">
                    <Link
                      href={`/${slug}/pos/${s.id}`}
                      className="font-mono text-xs font-medium text-[#00d992] hover:underline"
                    >
                      {s.sessionNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{userDisplayName(s.user)}</td>
                  <td className="px-4 py-2 text-right font-mono text-xs">
                    {formatAmount(s.openingBalance)}
                  </td>
                  <td className="px-4 py-2 text-right text-muted-foreground">
                    {s._count.sales}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Product preview (what the cashier would see in cart UI) */}
      <section className="rounded-lg border border-border bg-card">
        <header className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-sm font-semibold">Available Products</h2>
          <Link
            href={`/${slug}/inventory`}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Full catalog →
          </Link>
        </header>
        {recentProducts.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-muted-foreground">
            No active products. Add products in the inventory module.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">SKU</th>
                <th className="px-4 py-2 font-medium">Product</th>
                <th className="px-4 py-2 font-medium">Unit</th>
                <th className="px-4 py-2 text-right font-medium">Tier 1 Price</th>
                <th className="px-4 py-2 text-right font-medium">Cost</th>
              </tr>
            </thead>
            <tbody>
              {recentProducts.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-border last:border-0 transition-colors hover:bg-muted/30"
                >
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                    {p.sku ?? "—"}
                  </td>
                  <td className="px-4 py-2 font-medium">{p.name}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {p.unit}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-xs">
                    {p.tier1Price !== null ? formatAmount(p.tier1Price) : "—"}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-xs text-muted-foreground">
                    {formatAmount(p.baseCost)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="rounded-lg border border-dashed border-border bg-card px-6 py-8 text-center">
        <h3 className="text-sm font-semibold">Interactive Cart — Phase 2</h3>
        <p className="mt-2 text-xs text-muted-foreground">
          Wire up product search, line-item editing, payment method picker, and
          change calculation against{" "}
          <code className="font-mono text-[#00d992]">pos.sale.create</code>. Backend
          is fully implemented and tested — UI is the remaining piece.
        </p>
      </section>
    </div>
  );
}
