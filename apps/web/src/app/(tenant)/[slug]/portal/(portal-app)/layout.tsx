import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getPortalTenantBranding } from "@/server/lib/portal-tenant";
import { PortalNav } from "./portal-nav";

// Authed customer-portal shell — a slim top bar (NOT the staff AppSidebar),
// since this is a separate principal surface (Customer, not Staff) isolated
// by middleware.ts's resolvePrincipalIsolationRedirect. Same fail-closed
// robots posture as the staff (app) shell — this is never a public route.
export const metadata: Metadata = {
  title: "Customer Portal",
  robots: { index: false, follow: false },
};

interface PortalAppLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export default async function PortalAppLayout({ children, params }: PortalAppLayoutProps) {
  const { slug } = await params;
  const tenant = await getPortalTenantBranding(slug);
  if (tenant === null) {
    notFound();
  }

  return (
    <div data-fdl="portal-shell" className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/80">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <Avatar className="size-8 rounded-md">
              {tenant.logoUrl !== null && tenant.logoUrl !== "" && (
                <AvatarImage src={tenant.logoUrl} alt={tenant.name} />
              )}
              <AvatarFallback className="rounded-md text-xs font-semibold">
                {tenant.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight">{tenant.name}</p>
              <p className="text-[10px] text-muted-foreground">Customer Portal</p>
            </div>
          </div>

          <PortalNav slug={slug} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>

      <footer className="border-t border-border">
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
  );
}
