import Link from "next/link";
import { prisma } from "@orqafy/db";
import { ComplianceFooter } from "@/components/compliance-footer";

export const dynamic = "force-dynamic";

async function getPlans() {
  return prisma.plan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
}

export default async function LandingPage() {
  const plans = await getPlans();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded border border-primary bg-card signal-glow">
            <span className="text-sm font-bold text-primary" aria-hidden="true">O</span>
          </div>
          <span className="font-semibold tracking-tight">Orqafy</span>
        </div>
        <nav aria-label="Main navigation">
          <div className="flex items-center gap-3">
            <Link
              href="/demo-login"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Try demo
            </Link>
            <Link
              href="/privacy"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Privacy
            </Link>
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="rounded-md border border-primary bg-transparent px-4 py-1.5 text-sm font-medium text-primary transition-all hover:bg-primary/10"
            >
              Get started
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 py-24 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-primary signal-glow" aria-hidden="true" />
          <span className="text-xs text-primary">Multi-tenant operations platform</span>
        </div>
        <h1 className="mb-6 text-5xl font-bold leading-tight tracking-tight">
          Run your entire business
          <br />
          <span className="text-primary">from one platform</span>
        </h1>
        <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground">
          Field operations, HR, inventory, invoicing, and payroll — unified under one workspace.
          Built for teams that operate in the real world.
        </p>
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/register"
            className="rounded-md bg-primary px-6 py-3 text-sm font-semibold text-background transition-all hover:bg-primary hover:shadow-none"
          >
            Start free trial
          </Link>
          <Link
            href="/demo-login"
            className="rounded-md border border-border bg-card px-6 py-3 text-sm font-medium text-foreground transition-colors hover:border-primary/50 hover:text-primary"
          >
            Explore demo →
          </Link>
        </div>
      </section>

      {/* Feature grid */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {[
            { icon: "⚙️", label: "Job Orders" },
            { icon: "👥", label: "Employees & HR" },
            { icon: "📦", label: "Inventory" },
            { icon: "🧾", label: "Invoicing" },
            { icon: "💰", label: "Payroll" },
            { icon: "📊", label: "Reports" },
          ].map(({ icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3"
            >
              <span className="text-lg">{icon}</span>
              <span className="text-sm font-medium">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section aria-labelledby="pricing-heading" className="border-t border-border py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-12 text-center">
            <h2 id="pricing-heading" className="mb-3 text-3xl font-bold">Simple, transparent pricing</h2>
            <p className="text-muted-foreground">No setup fees. Cancel any time.</p>
          </div>
          {plans.length === 0 ? (
            <p className="text-center text-muted-foreground">Pricing plans coming soon.</p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {plans.map((plan) => {
                const features = (Array.isArray(plan.features) ? plan.features : []).filter(
                  (f): f is string => typeof f === "string"
                );
                const price = Number(plan.priceMonthly);

                return (
                  <div
                    key={plan.id}
                    className="flex flex-col rounded-lg border border-border bg-card p-6"
                  >
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold">{plan.name}</h3>
                      {plan.description !== null && (
                        <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                      )}
                    </div>
                    <div className="mb-6">
                      <span className="text-4xl font-bold">
                        {price === 0
                          ? "Free"
                          : `₱${price.toLocaleString()}`}
                      </span>
                      {price > 0 && (
                        <span className="ml-1 text-sm text-muted-foreground">/mo</span>
                      )}
                    </div>
                    <ul className="mb-6 flex-1 space-y-2">
                      <li className="flex items-center gap-2 text-sm">
                        <span className="text-primary" aria-hidden="true">✓</span>
                        <span>Up to {plan.maxUsers} users</span>
                      </li>
                      <li className="flex items-center gap-2 text-sm">
                        <span className="text-primary" aria-hidden="true">✓</span>
                        <span>{Math.round(plan.maxStorageMb / 1024)} GB storage</span>
                      </li>
                      {features.slice(0, 3).map((f, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm">
                          <span className="text-primary" aria-hidden="true">✓</span>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={`/register?plan=${plan.slug}`}
                      className="block rounded-md border border-primary px-4 py-2 text-center text-sm font-medium text-primary transition-all hover:bg-primary/10"
                    >
                      Get started
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <ComplianceFooter />
    </div>
  );
}
