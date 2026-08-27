import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import AuthBackgroundShape from "@/assets/svg/auth-background-shape";
import { getPortalTenantBranding } from "@/server/lib/portal-tenant";
import { PortalAcceptForm } from "./accept-form";

export const dynamic = "force-dynamic";

// PUBLIC set-password page (public-paths.ts PORTAL_AUTH_PATH_RE) —
// token-authorized, no session required. noindex,nofollow: a per-customer
// invite link must never be crawled/cached.
export const metadata: Metadata = {
  title: "Set Your Password",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string }>;
}

export default async function PortalAcceptPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { token } = await searchParams;

  const tenant = await getPortalTenantBranding(slug);
  if (tenant === null) {
    notFound();
  }

  return (
    <div
      data-fdl="portal-accept"
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
            <CardTitle className="mb-1.5 text-2xl">Set Your Password</CardTitle>
            <CardDescription className="text-base">
              Choose a password to activate your customer portal account.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <PortalAcceptForm tenantSlug={slug} token={token ?? ""} />
        </CardContent>
      </Card>
    </div>
  );
}
