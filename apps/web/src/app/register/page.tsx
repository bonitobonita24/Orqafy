import type { Metadata } from "next";
import { prisma } from "@orqafy/db";
import { RegisterForm } from "./register-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Logo from "@/components/shadcn-studio/logo";
import AuthBackgroundShape from "@/assets/svg/auth-background-shape";

export const metadata: Metadata = {
  title: "Create your workspace",
  description: "Set up your Orqafy workspace in under 2 minutes.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/register" },
  openGraph: {
    title: "Create your workspace — Orqafy",
    description: "Set up your Orqafy workspace in under 2 minutes.",
    url: "/register",
  },
};

export const dynamic = "force-dynamic";

async function getActivePlans() {
  const plans = await prisma.plan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, slug: true, name: true, priceMonthly: true },
  });
  // Serialize the Prisma Decimal to a plain number before it crosses the
  // Server→Client component boundary (RegisterForm is a Client Component);
  // raw Decimal instances are not plain objects and trip React's RSC guard.
  return plans.map((p) => ({ ...p, priceMonthly: Number(p.priceMonthly) }));
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const [plans, { plan: defaultPlan }] = await Promise.all([
    getActivePlans(),
    searchParams,
  ]);

  return (
    <div className="relative flex h-auto min-h-screen w-full items-center justify-center overflow-x-hidden px-4 py-10 sm:px-6 lg:px-8">
      <div className="absolute">
        <AuthBackgroundShape />
      </div>

      <Card className="z-1 w-full border-none shadow-md sm:max-w-lg">
        <CardHeader className="gap-6">
          <Logo className="gap-3" />

          <div>
            <CardTitle className="mb-1.5 text-2xl">Create your workspace</CardTitle>
            <CardDescription className="text-base">
              Set up your Orqafy account in under 2 minutes.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <div className="space-y-4">
            <RegisterForm plans={plans} defaultPlan={defaultPlan} />

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <a href="/login" className="text-card-foreground hover:underline">
                Sign in
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
