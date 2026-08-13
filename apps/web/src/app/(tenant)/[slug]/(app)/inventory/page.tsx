import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Package } from "@/components/ui/icons";
import { prisma } from "@orqafy/db";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
      <PageHeader
        title="Products"
        description={`${active.length} active of ${products.length} total`}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href={`/${slug}/inventory/categories`}>Categories</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/${slug}/inventory/warehouses`}>Warehouses</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/${slug}/inventory/stock-movements`}>Stock Movements →</Link>
            </Button>
            <Button asChild>
              <Link href={`/${slug}/inventory/products/new`}>+ Add Product</Link>
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="p-0">
          {products.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Package}
                title="No products yet."
                action={
                  <Button asChild>
                    <Link href={`/${slug}/inventory/products/new`}>Add your first product</Link>
                  </Button>
                }
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name / SKU</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Base Cost</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Edit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
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
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.category !== null ? p.category.name : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.unit}</TableCell>
                    <TableCell className="text-muted-foreground">
                      ₱
                      {Number(p.baseCost).toLocaleString("en-PH", {
                        minimumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell>
                      <ProductToggle id={p.id} name={p.name} isActive={p.isActive} />
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/${slug}/inventory/products/${p.id}/edit`}
                        className="text-xs text-muted-foreground transition-colors hover:text-primary"
                      >
                        Edit
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
