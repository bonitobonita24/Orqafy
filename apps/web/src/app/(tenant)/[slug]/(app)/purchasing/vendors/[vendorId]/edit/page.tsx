import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";
import { VendorForm } from "../../vendor-form";
import { VendorDeactivateButton } from "./vendor-deactivate-button";

export const metadata: Metadata = { title: "Edit Vendor" };
export const dynamic = "force-dynamic";

async function getVendor(id: string) {
  return prisma.vendor.findUnique({
    where: { id },
    select: {
      id: true,
      type: true,
      companyName: true,
      contactName: true,
      email: true,
      phone: true,
      address: true,
      platformUrl: true,
      platformName: true,
      paymentTerms: true,
      notes: true,
      isActive: true,
      tenantId: true,
    },
  });
}

export default async function EditVendorPage({
  params,
}: {
  params: Promise<{ slug: string; vendorId: string }>;
}) {
  const { slug, vendorId } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) notFound();
  const vendor = await getVendor(vendorId);

  // tenant-scoped: prevents cross-tenant data leak
  if (vendor === null || vendor.tenantId !== tenant.id) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/${slug}/purchasing/vendors`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Vendors
        </Link>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Edit Vendor</h1>
          <p className="text-sm text-muted-foreground">{vendor.companyName}</p>
        </div>
        {/* HOLD(owner-rule): reactivation flow — when/who can reactivate a deactivated vendor? */}
        {vendor.isActive && (
          <VendorDeactivateButton slug={slug} vendorId={vendorId} companyName={vendor.companyName} />
        )}
        {!vendor.isActive && (
          <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            Inactive
          </span>
        )}
      </div>
      <div className="rounded-lg border border-border bg-card p-6">
        <VendorForm
          slug={slug}
          mode="edit"
          vendorId={vendorId}
          initial={{
            type: vendor.type as "direct" | "ecommerce",
            companyName: vendor.companyName,
            contactName: vendor.contactName ?? undefined,
            email: vendor.email ?? undefined,
            phone: vendor.phone ?? undefined,
            address: vendor.address ?? undefined,
            platformUrl: vendor.platformUrl ?? undefined,
            platformName: vendor.platformName ?? undefined,
            paymentTerms: vendor.paymentTerms ?? undefined,
            notes: vendor.notes ?? undefined,
          }}
        />
      </div>
    </div>
  );
}
