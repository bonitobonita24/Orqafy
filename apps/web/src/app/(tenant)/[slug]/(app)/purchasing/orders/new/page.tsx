import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@orqafy/db";
import { PoForm } from "./po-form";

export const metadata: Metadata = { title: "New Purchase Order" };
export const dynamic = "force-dynamic";

async function getActiveVendors() {
  return prisma.vendor.findMany({
    where: { isActive: true },
    orderBy: { companyName: "asc" },
    select: { id: true, companyName: true },
  });
}

export default async function NewPoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const vendors = await getActiveVendors();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/${slug}/purchasing`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Purchase Orders
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Purchase Order</h1>
        <p className="text-sm text-muted-foreground">
          Create a draft PO with line items. The PO will be saved as a draft until submitted.
        </p>
      </div>
      {vendors.length === 0 ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
          No active vendors found.{" "}
          <Link href={`/${slug}/purchasing/vendors/new`} className="underline">
            Add a vendor first.
          </Link>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card p-6">
          <PoForm slug={slug} vendors={vendors} />
        </div>
      )}
    </div>
  );
}
