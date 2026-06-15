import type { Metadata } from "next";
import Link from "next/link";
import { VendorForm } from "../vendor-form";

export const metadata: Metadata = { title: "New Vendor" };

export default async function NewVendorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

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
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Vendor</h1>
        <p className="text-sm text-muted-foreground">
          Add a supplier or e-commerce seller to your vendor list.
        </p>
      </div>
      <div className="rounded-lg border border-border bg-card p-6">
        <VendorForm slug={slug} mode="create" />
      </div>
    </div>
  );
}
