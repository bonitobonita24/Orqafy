import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@orqafy/db";
import { auth } from "@/server/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Receipt, Package, Wrench } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ slug: string }>;
}

const SECTIONS = [
  { label: "Invoices", href: "invoices", icon: Receipt, description: "View and pay your invoices." },
  { label: "Orders", href: "orders", icon: Package, description: "Track your order history." },
  { label: "Repairs", href: "repairs", icon: Wrench, description: "Check the status of your repairs." },
] as const;

// Minimal authed landing — greets the customer from the real session +
// Customer row. The aggregated dashboard summary (recent invoices/orders/
// repairs counts) is Wave 3 T3.4; this page deliberately stays a clean
// placeholder-cards landing, never fabricated data.
export default async function PortalHomePage({ params }: PageProps) {
  const { slug } = await params;
  const session = await auth();

  // Defense-in-depth alongside middleware.ts's principal-isolation redirect —
  // this page must never render for a non-customer / invalidated session.
  if (
    session === null ||
    session.principalType !== "customer" ||
    session.customerId === undefined ||
    session.customerId === "" ||
    session.error === "SESSION_INVALIDATED"
  ) {
    redirect(`/${slug}/portal/login`);
  }

  const customer = await prisma.customer.findUnique({
    where: { id: session.customerId },
    select: { firstName: true, lastName: true, companyName: true },
  });

  const displayName =
    customer?.companyName ?? `${customer?.firstName ?? ""} ${customer?.lastName ?? ""}`.trim();

  return (
    <div data-fdl="portal-home" className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">
          Welcome{displayName !== "" ? `, ${displayName}` : ""}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here&apos;s quick access to your account.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {SECTIONS.map(({ label, href, icon: Icon, description }) => (
          <Link key={href} href={`/${slug}/portal/${href}`}>
            <Card className="h-full transition hover:border-primary/50 hover:shadow-sm">
              <CardHeader className="flex-row items-center gap-3 space-y-0">
                <Icon className="size-6 shrink-0 text-muted-foreground" />
                <CardTitle className="text-base">{label}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{description}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
