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

  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) return <div>Tenant not found</div>;

  const [openSessions, warehouses, productsRaw] = await Promise.all([
    prisma.pOSSession.findMany({
      // tenant-scoped: prevents cross-tenant data leak
      where: { tenantId: tenant.id, status: "open" },
      orderBy: { openedAt: "desc" },
      take: 20,
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, displayName: true },
        },
      },
    }),
    prisma.warehouse.findMany({
      // tenant-scoped: prevents cross-tenant data leak
      where: { tenantId: tenant.id, isActive: true },
      orderBy: [{ isDefault: "desc" }, { code: "asc" }],
      select: { id: true, name: true, code: true, isDefault: true },
    }),
    prisma.product.findMany({
      // tenant-scoped: prevents cross-tenant data leak
      where: { tenantId: tenant.id, isActive: true },
      orderBy: { name: "asc" },
      take: 200,
      select: {
        id: true,
        sku: true,
        name: true,
        unit: true,
        tier1Price: true,
        // Additive select — grid card image + category chip (V32.37 R3 graft).
        categoryId: true,
        category: { select: { id: true, name: true } },
        ecommerceImageUrls: true,
        warehouseStocks: { select: { warehouseId: true, quantity: true } },
      },
    }),
  ]);

  // Serialize Decimal → number so the Client Component receives plain JSON.
  const products = productsRaw.map((p) => {
    const imageUrls = Array.isArray(p.ecommerceImageUrls)
      ? (p.ecommerceImageUrls as unknown[]).filter(
          (u): u is string => typeof u === "string",
        )
      : [];
    return {
      id: p.id,
      sku: p.sku,
      name: p.name,
      unit: p.unit,
      tier1Price: p.tier1Price === null ? null : Number(p.tier1Price),
      categoryId: p.categoryId,
      categoryName: p.category?.name ?? null,
      imageUrl: imageUrls[0] ?? null,
      stockByWarehouse: p.warehouseStocks.map((s) => ({
        warehouseId: s.warehouseId,
        quantity: Number(s.quantity),
      })),
    };
  });

  return (
    <div className="flex h-[calc(100vh-9rem)] min-h-[640px] flex-col gap-3">
      <div className="flex shrink-0 items-baseline justify-between gap-2">
        <div>
          <Link
            href={`/${slug}/pos`}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            ← POS Sessions
          </Link>
          <h1 className="mt-1 text-xl font-bold tracking-tight">New Sale</h1>
        </div>
        <p className="hidden text-xs text-muted-foreground sm:block">
          Posts to <code className="font-mono text-primary">pos.sale.create</code>{" "}
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
