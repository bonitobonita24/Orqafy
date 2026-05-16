import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@orqafy/db";
import { CartClient } from "./cart-client";

export const metadata: Metadata = { title: "New POS Sale" };
export const dynamic = "force-dynamic";

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

  const [openSessions, warehouses, productsRaw] = await Promise.all([
    prisma.pOSSession.findMany({
      where: { status: "open" },
      orderBy: { openedAt: "desc" },
      take: 20,
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, displayName: true },
        },
      },
    }),
    prisma.warehouse.findMany({
      where: { isActive: true },
      orderBy: [{ isDefault: "desc" }, { code: "asc" }],
      select: { id: true, name: true, code: true, isDefault: true },
    }),
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      take: 200,
      select: {
        id: true,
        sku: true,
        name: true,
        unit: true,
        tier1Price: true,
      },
    }),
  ]);

  // Serialize Decimal → number so the Client Component receives plain JSON.
  const products = productsRaw.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    unit: p.unit,
    tier1Price: p.tier1Price === null ? null : Number(p.tier1Price),
  }));

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
          Ring up products, accept payment, and the sale will post to{" "}
          <code className="font-mono text-[#00d992]">pos.sale.create</code>{" "}
          atomically with inventory decrement.
        </p>
      </div>

      <CartClient
        openSessions={openSessions.map((s) => ({
          id: s.id,
          sessionNumber: s.sessionNumber,
          cashier: userDisplayName(s.user),
        }))}
        warehouses={warehouses}
        products={products}
      />
    </div>
  );
}
