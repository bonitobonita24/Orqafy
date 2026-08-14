import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@orqafy/db";
import { ComplianceFooter } from "@/components/compliance-footer";
import Header from "@/components/shadcn-studio/blocks/hero-section-01/header";
import HeroSection from "@/components/shadcn-studio/blocks/hero-section-01/hero-section-01";
import Features from "@/components/shadcn-studio/blocks/features-section-01/features-section-01";
import CTASection from "@/components/shadcn-studio/blocks/cta-section-10/cta-section-10";
import { Briefcase, Users, Package, Receipt, Wallet, BarChart3 } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  title: "Orqafy — Move as one",
  description:
    "Move as one — the all-in-one project & business operations platform for growing businesses.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
  openGraph: {
    title: "Orqafy — Move as one",
    description:
      "Move as one — the all-in-one project & business operations platform for growing businesses.",
    url: "/",
  },
};

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Orqafy",
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`, // TODO(seo): add default OG image asset (also usable as logo)
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Orqafy",
    url: SITE_URL,
  },
];

const NAV_ITEMS = [
  { title: "Try demo", href: "/demo-login" },
  { title: "Privacy", href: "/privacy" },
];

const FEATURES_LIST = [
  {
    icon: Briefcase,
    title: "Job Orders",
    description: "Plan, dispatch, and track field work from a single operations board.",
    cardBorderColor: "",
    avatarTextColor: "text-primary",
    avatarBgColor: "bg-primary/10",
  },
  {
    icon: Users,
    title: "Employees & HR",
    description: "Attendance, DTR, and workforce records, unified across every team.",
    cardBorderColor: "",
    avatarTextColor: "text-primary",
    avatarBgColor: "bg-primary/10",
  },
  {
    icon: Package,
    title: "Inventory",
    description: "Real-time stock levels, purchase orders, and goods receipts.",
    cardBorderColor: "",
    avatarTextColor: "text-primary",
    avatarBgColor: "bg-primary/10",
  },
  {
    icon: Receipt,
    title: "Invoicing",
    description: "Create, send, and track invoices — synced straight to your books.",
    cardBorderColor: "",
    avatarTextColor: "text-primary",
    avatarBgColor: "bg-primary/10",
  },
  {
    icon: Wallet,
    title: "Payroll",
    description: "Run payroll with confidence — deductions, payslips, and disbursement.",
    cardBorderColor: "",
    avatarTextColor: "text-primary",
    avatarBgColor: "bg-primary/10",
  },
  {
    icon: BarChart3,
    title: "Reports",
    description: "Operational and financial reports that stay current, automatically.",
    cardBorderColor: "",
    avatarTextColor: "text-primary",
    avatarBgColor: "bg-primary/10",
  },
];

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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Header
        navigationData={NAV_ITEMS}
        secondaryCtaLabel="Sign in"
        secondaryCtaHref="/login"
        primaryCtaLabel="Get started"
        primaryCtaHref="/register"
      />

      <HeroSection />

      <Features
        heading="Everything your business needs, in one place"
        description="Field operations, HR, inventory, invoicing, and payroll — unified under one workspace built for teams that operate in the real world."
        featuresList={FEATURES_LIST}
      />

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

      <CTASection
        heading="Ready to move as one?"
        description="Start free — no credit card required. Bring your whole operation onto one platform today."
        ctaLabel="Start free trial"
        ctaHref="/register"
      />

      {/* Footer */}
      <ComplianceFooter />
    </div>
  );
}
