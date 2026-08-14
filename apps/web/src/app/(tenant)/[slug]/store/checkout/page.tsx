import type { Metadata } from "next";
import type { ReactNode } from "react";

import { CheckoutForm } from "./checkout-form";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: true },
};

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function CheckoutPage({
  params,
}: PageProps): Promise<ReactNode> {
  const { slug } = await params;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Checkout</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Complete your order. Payment is on delivery or via bank transfer — we
          will contact you with the details after you submit.
        </p>
      </div>
      <CheckoutForm tenantSlug={slug} />
    </main>
  );
}
