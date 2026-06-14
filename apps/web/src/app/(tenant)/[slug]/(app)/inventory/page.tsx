import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@orqafy/db";

export const metadata: Metadata = { title: "Products" };

export const dynamic = "force-dynamic";

async function getProducts() {
  return prisma.product.findMany({
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

export default async function InventoryPage() {
  const products = await getProducts();
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
        <Link
          href="inventory/stock-movements"
          className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/30"
        >
          Stock Movements →
        </Link>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {products.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            No products yet.
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
                      href={`inventory/stock-movements?productId=${p.id}`}
                      title="View stock movements for this product"
                      className="font-medium transition-colors hover:text-[#00d992]"
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
                    ₱{Number(p.baseCost).toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-4 py-3">
                    {p.isActive ? (
                      <span className="rounded-full border border-[#00d992]/30 bg-[#00d992]/10 px-2 py-0.5 text-xs font-medium text-[#00d992]">
                        Active
                      </span>
                    ) : (
                      <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        Inactive
                      </span>
                    )}
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
