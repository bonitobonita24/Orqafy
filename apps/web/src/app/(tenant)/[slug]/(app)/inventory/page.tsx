import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";
import { ProductToggle } from "./products/product-toggle";

export const metadata: Metadata = { title: "Products" };

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getProducts(tenantId: string) {
  return prisma.product.findMany({
    where: { tenantId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      sku: true,
      unit: true,
      baseCost: true,
      isActive: true,
      category: { select: { name: true } },
    },
  });
}

export default async function InventoryPage({ params }: PageProps) {
  const { slug } = await params;

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!tenant) notFound();

  const products = await getProducts(tenant.id);
  const active = products.filter((p) => p.isActive);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Products</h1>
          <p className="text-sm text-muted-foreground">
            {active.length} active of {products.length} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/${slug}/inventory/categories`}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/30"
          >
            Categories
          </Link>
          <Link
            href={`/${slug}/inventory/warehouses`}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/30"
          >
            Warehouses
          </Link>
          <Link
            href={`/${slug}/inventory/stock-movements`}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/30"
          >
            Stock Movements →
          </Link>
          <Link
            href={`/${slug}/inventory/products/new`}
            className="rounded-md border border-primary bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
          >
            + Add Product
          </Link>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {products.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            No products yet.{" "}
            <Link
              href={`/${slug}/inventory/products/new`}
              className="text-primary hover:underline"
            >
              Add one
            </Link>
            .
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Name / SKU</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Unit</th>
                <th className="px-4 py-3 font-medium">Base Cost</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Edit</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-border last:border-0 transition-colors hover:bg-muted/30"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/${slug}/inventory/stock-movements?productId=${p.id}`}
                      title="View stock movements for this product"
                      className="font-medium transition-colors hover:text-primary"
                    >
                      {p.name}
                    </Link>
                    {p.sku !== null && (
                      <div className="text-xs text-muted-foreground">{p.sku}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.category !== null ? p.category.name : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.unit}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    ₱
                    {Number(p.baseCost).toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <ProductToggle
                      id={p.id}
                      name={p.name}
                      isActive={p.isActive}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/${slug}/inventory/products/${p.id}/edit`}
                      className="text-xs text-muted-foreground transition-colors hover:text-primary"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
