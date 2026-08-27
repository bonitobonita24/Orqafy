import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import AuthBackgroundShape from "@/assets/svg/auth-background-shape";
import { getPortalTenantBranding } from "@/server/lib/portal-tenant";
import { PortalLoginForm } from "./login-form";

export const dynamic = "force-dynamic";

// PUBLIC customer-portal login (public-paths.ts PORTAL_AUTH_PATH_RE) —
// noindex,nofollow: it's a per-tenant credential surface, not a marketing
// page (mirrors the staff /login page's `robots.index: false`).
export const metadata: Metadata = {
  title: "Customer Sign In",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function PortalLoginPage({ params }: PageProps) {
  const { slug } = await params;
  const tenant = await getPortalTenantBranding(slug);
  if (tenant === null) {
    notFound();
  }

  return (
    <div
      data-fdl="portal-login"
      className="relative flex h-auto min-h-screen w-full items-center justify-center overflow-x-hidden px-4 py-10 sm:px-6 lg:px-8"
    >
      <div className="absolute">
        <AuthBackgroundShape />
      </div>

      <Card className="z-1 w-full border-none shadow-md sm:max-w-lg">
        <CardHeader className="gap-6">
          <div className="flex items-center gap-3">
            <Avatar className="size-10 rounded-md">
              {tenant.logoUrl !== null && tenant.logoUrl !== "" && (
                <AvatarImage src={tenant.logoUrl} alt={tenant.name} />
              )}
              <AvatarFallback className="rounded-md text-sm font-semibold">
                {tenant.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-xl font-bold">{tenant.name}</span>
          </div>

          <div>
            <CardTitle className="mb-1.5 text-2xl">Customer Portal</CardTitle>
            <CardDescription className="text-base">
              Sign in to view your invoices, orders, and repairs.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <PortalLoginForm tenantSlug={slug} />
        </CardContent>
      </Card>
    </div>
  );
}
