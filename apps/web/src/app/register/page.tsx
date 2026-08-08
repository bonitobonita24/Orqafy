import type { Metadata } from "next";
import { prisma } from "@orqafy/db";
import { RegisterForm } from "./register-form";

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
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-primary bg-card signal-glow">
            <span className="text-2xl font-bold text-primary">O</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Create your workspace</h1>
          <p className="text-sm text-muted-foreground">
            Set up your Orqafy account in under 2 minutes
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-6">
          <RegisterForm plans={plans} defaultPlan={defaultPlan} />
        </div>
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <a href="/login" className="text-primary hover:underline">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
