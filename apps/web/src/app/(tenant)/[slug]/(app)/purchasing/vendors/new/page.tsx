import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
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
      <div>
        <Link
          href={`/${slug}/purchasing/vendors`}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← Vendors
        </Link>
      </div>
      <PageHeader
        title="New Vendor"
        description="Add a supplier or e-commerce seller to your vendor list."
      />
      <Card>
        <CardContent className="p-6">
          <VendorForm slug={slug} mode="create" />
        </CardContent>
      </Card>
    </div>
  );
}
