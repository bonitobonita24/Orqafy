import Link from "next/link";
import type { ReactNode } from "react";

import { CartDrawer } from "@/components/cart/cart-drawer";
import { Separator } from "@/components/ui/separator";
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
      <div className="flex min-h-screen flex-col bg-background">
        <header
          data-fdl="store-header"
          className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/80"
        >
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
        <div className="flex flex-1 flex-col">{children}</div>
        <footer data-fdl="store-footer" className="border-t border-border">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-10 sm:grid-cols-2">
            <div className="flex flex-col gap-3">
              <div className="text-sm font-semibold">Shop</div>
              <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                <Link
                  href={`/${slug}/store/products`}
                  className="transition hover:text-primary"
                >
                  Shop
                </Link>
                <Link
                  href={`/${slug}/store/orders/track`}
                  className="transition hover:text-primary"
                >
                  Track order
                </Link>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <div className="text-sm font-semibold">Quick links</div>
              <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                <Link
                  href={`/${slug}/store/products`}
                  className="transition hover:text-primary"
                >
                  Shop
                </Link>
                <Link
                  href={`/${slug}/store/orders/track`}
                  className="transition hover:text-primary"
                >
                  Track order
                </Link>
                <Link
                  href={`/${slug}/store/checkout`}
                  className="transition hover:text-primary"
                >
                  Checkout
                </Link>
              </div>
            </div>
          </div>
          <Separator />
          <div className="mx-auto flex max-w-6xl justify-center px-4 py-4">
            <a
              href="https://www.powerbyteitsolutions.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground transition hover:text-primary"
            >
              Developed by Powerbyte IT Solutions
            </a>
          </div>
        </footer>
      </div>
    </CartProvider>
  );
}
