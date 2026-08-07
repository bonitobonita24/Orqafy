import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StockActions } from "./stock-actions";

export const metadata: Metadata = { title: "Stock Movements" };

export const dynamic = "force-dynamic";

const TYPE_OPTIONS = ["all", "in", "out", "transfer", "adjustment"] as const;
type TypeOption = (typeof TYPE_OPTIONS)[number];

const TYPE_STYLES: Record<string, string> = {
  in: "border-primary/30 bg-primary/10 text-primary",
  out: "border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400",
  transfer: "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  adjustment: "border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400",
};

function isTypeOption(value: string | undefined): value is TypeOption {
  return value !== undefined && (TYPE_OPTIONS as readonly string[]).includes(value);
}

async function getStockMovements(
  tenantId: string,
  filters: { type?: string; warehouseId?: string; productId?: string },
) {
  const where: {
    tenantId: string;
    type?: string;
    productId?: string;
    OR?: Array<{ fromWarehouseId: string } | { toWarehouseId: string }>;
  } = { tenantId };
  if (filters.type !== undefined && filters.type !== "all" && isTypeOption(filters.type)) {
    where.type = filters.type;
  }
  if (filters.productId !== undefined && filters.productId !== "") {
    where.productId = filters.productId;
  }
  if (filters.warehouseId !== undefined && filters.warehouseId !== "") {
    where.OR = [
      { fromWarehouseId: filters.warehouseId },
      { toWarehouseId: filters.warehouseId },
    ];
  }
  return prisma.stockMovement.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      type: true,
      quantity: true,
      notes: true,
      referenceType: true,
      createdAt: true,
      product: { select: { id: true, name: true, sku: true, unit: true } },
      fromWarehouse: { select: { id: true, name: true } },
      toWarehouse: { select: { id: true, name: true } },
    },
  });
}

async function getWarehouses(tenantId: string) {
  return prisma.warehouse.findMany({
    where: { tenantId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true },
  });
}

async function getProducts(tenantId: string) {
  return prisma.product.findMany({
    where: { tenantId, isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, unit: true },
  });
}

async function getProduct(productId: string, tenantId: string) {
  return prisma.product.findFirst({
    where: { id: productId, tenantId },
    select: { id: true, name: true, sku: true },
  });
}

export default async function StockMovementsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ type?: string; warehouseId?: string; productId?: string }>;
}) {
  const { slug } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!tenant) notFound();

  const { type, warehouseId, productId } = await searchParams;
  const filters: { type?: string; warehouseId?: string; productId?: string } = {};
  if (type !== undefined) filters.type = type;
  if (warehouseId !== undefined) filters.warehouseId = warehouseId;
  if (productId !== undefined && productId !== "") filters.productId = productId;
  const [movements, warehouses, products, product] = await Promise.all([
    getStockMovements(tenant.id, filters),
    getWarehouses(tenant.id),
    getProducts(tenant.id),
    productId !== undefined && productId !== ""
      ? getProduct(productId, tenant.id)
      : Promise.resolve(null),
  ]);

  const counts = {
    in: movements.filter((m) => m.type === "in").length,
    out: movements.filter((m) => m.type === "out").length,
    transfer: movements.filter((m) => m.type === "transfer").length,
    adjustment: movements.filter((m) => m.type === "adjustment").length,
  };

  const activeType: TypeOption = isTypeOption(type) ? type : "all";

  function buildHref(nextType: TypeOption): string {
    const params = new URLSearchParams();
    if (nextType !== "all") params.set("type", nextType);
    if (warehouseId !== undefined && warehouseId !== "") params.set("warehouseId", warehouseId);
    if (productId !== undefined && productId !== "") params.set("productId", productId);
    const qs = params.toString();
    return qs.length > 0 ? `?${qs}` : "?";
  }

  const clearProductParams = new URLSearchParams();
  if (activeType !== "all") clearProductParams.set("type", activeType);
  if (warehouseId !== undefined && warehouseId !== "") clearProductParams.set("warehouseId", warehouseId);
  const clearProductQs = clearProductParams.toString();
  const clearProductHref = clearProductQs.length > 0 ? `?${clearProductQs}` : "?";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Movements"
        description={`${movements.length} shown · ${counts.in} in · ${counts.out} out · ${counts.transfer} transfer · ${counts.adjustment} adjustment`}
        actions={
          <>
            <StockActions products={products} warehouses={warehouses} />
            <Button variant="outline" asChild>
              <Link href={`/${slug}/inventory`}>← Products</Link>
            </Button>
          </>
        }
      />

      {product !== null && (
        <div className="flex items-center justify-between rounded-md border border-primary/30 bg-primary/10 px-4 py-2 text-sm">
          <span className="text-primary">
            Filtered by product: <span className="font-medium">{product.name}</span>
            {product.sku !== null && (
              <span className="ml-2 text-xs text-primary/80">{product.sku}</span>
            )}
          </span>
          <Link
            href={clearProductHref}
            className="text-xs font-medium text-primary underline-offset-2 hover:underline"
          >
            Clear
          </Link>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {TYPE_OPTIONS.map((t) => {
            const isActive = activeType === t;
            return (
              <Link
                key={t}
                href={buildHref(t)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  isActive
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:bg-muted/30"
                }`}
              >
                {t === "all" ? "All Types" : t.charAt(0).toUpperCase() + t.slice(1)}
              </Link>
            );
          })}
        </div>

        <form className="flex items-center gap-2" method="get">
          {activeType !== "all" && <input type="hidden" name="type" value={activeType} />}
          {productId !== undefined && productId !== "" && (
            <input type="hidden" name="productId" value={productId} />
          )}
          <label className="text-xs text-muted-foreground" htmlFor="warehouseId">
            Warehouse:
          </label>
          <select
            id="warehouseId"
            name="warehouseId"
            defaultValue={warehouseId ?? ""}
            className="rounded-md border border-border bg-card px-3 py-1 text-sm"
          >
            <option value="">All warehouses</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-md border border-border bg-card px-3 py-1 text-xs font-medium transition-colors hover:bg-muted/30"
          >
            Apply
          </button>
        </form>
      </div>

      <Card>
        <CardContent className="p-0">
          {movements.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
              No stock movements match these filters.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>From → To</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Notes / Ref</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((m) => {
                  const typeStyle =
                    TYPE_STYLES[m.type] ?? "border-border bg-muted text-muted-foreground";
                  const fromName = m.fromWarehouse !== null ? m.fromWarehouse.name : "—";
                  const toName = m.toWarehouse !== null ? m.toWarehouse.name : "—";
                  const noteOrRef =
                    m.notes !== null && m.notes !== ""
                      ? m.notes
                      : m.referenceType !== null
                        ? `Ref: ${m.referenceType}`
                        : "—";
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="text-muted-foreground">
                        {m.createdAt.toISOString().slice(0, 10)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`rounded-full ${typeStyle}`}>
                          {m.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{m.product.name}</span>
                        {m.product.sku !== null && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {m.product.sku}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {fromName} → {toName}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {Number(m.quantity).toLocaleString("en-PH", {
                          minimumFractionDigits: 2,
                        })}{" "}
                        {m.product.unit}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{noteOrRef}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
