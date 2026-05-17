import type { ReactNode } from "react";

import { CheckoutForm } from "./checkout-form";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function CheckoutPage({
  params,
}: PageProps): Promise<ReactNode> {
  const { slug } = await params;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Checkout</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Complete your order. Payment is on delivery or via bank transfer — we
          will contact you with the details after you submit.
        </p>
      </div>
      <CheckoutForm tenantSlug={slug} />
    </main>
  );
}
