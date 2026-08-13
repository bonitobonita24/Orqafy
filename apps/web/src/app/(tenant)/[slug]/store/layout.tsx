import Link from "next/link";
import type { ReactNode } from "react";

import { CartDrawer } from "@/components/cart/cart-drawer";
import { CartProvider } from "@/lib/cart-store";

interface LayoutProps {
  params: Promise<{ slug: string }>;
  children: ReactNode;
}

export default async function StoreLayout({
  params,
  children,
}: LayoutProps): Promise<ReactNode> {
  const { slug } = await params;

  return (
    <CartProvider tenantSlug={slug}>
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/80">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link
              href={`/${slug}/store/products`}
              className="text-sm font-semibold transition hover:text-primary"
            >
              Shop
            </Link>
            <div className="flex items-center gap-4">
              <Link
                href={`/${slug}/store/orders/track`}
                className="text-sm text-muted-foreground transition hover:text-primary"
              >
                Track order
              </Link>
              <CartDrawer />
            </div>
          </div>
        </header>
        {children}
      </div>
    </CartProvider>
  );
}
