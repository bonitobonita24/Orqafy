import type { Metadata } from "next";
import Link from "next/link";
import { BookOpenCheck, Calculator, CalendarRange, NotebookText, Settings2 } from "@/components/ui/icons";
import { prisma } from "@orqafy/db";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Accounting" };
export const dynamic = "force-dynamic";

async function getSummary(slug: string) {
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) return null;
  const [accountCount, draftEntries, fiscalYears] = await Promise.all([
    prisma.account.count({ where: { tenantId: tenant.id, isActive: true } }),
    prisma.journalEntry.count({ where: { tenantId: tenant.id, status: "draft" } }),
    prisma.fiscalYear.findMany({
      where: { tenantId: tenant.id, isClosed: false },
      orderBy: { startDate: "desc" },
      take: 1,
      select: { name: true },
    }),
  ]);
  return { accountCount, draftEntries, currentFiscalYear: fiscalYears[0]?.name ?? null };
}

// Static KPI stat card — Card/CardContent + Separator idiom shared with the
// banking dashboard (no trend badge — point-in-time counts, not period deltas).
function KPICard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="px-5 py-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

const MODULE_LINKS = [
  {
    href: "accounts",
    icon: BookOpenCheck,
    title: "Chart of Accounts",
    description: "Create and manage account codes (asset, liability, equity, revenue, expense).",
  },
  {
    href: "journal-entries",
    icon: NotebookText,
    title: "Journal Entries",
    description: "Create draft entries, post to the ledger, and reverse posted entries.",
  },
  {
    href: "trial-balance",
    icon: Calculator,
    title: "Trial Balance",
    description: "Per-account aggregation of posted debit/credit lines with balance verification.",
  },
  {
    href: "fiscal-years",
    icon: CalendarRange,
    title: "Fiscal Years",
    description: "Define accounting periods. A closed fiscal year blocks new postings dated within its range.",
  },
  {
    href: "settings",
    icon: Settings2,
    title: "Settings",
    description: "Default GL account mapping for JE auto-post (inventory, AP, expense) + default fiscal year.",
  },
] as const;

export default async function AccountingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const summary = await getSummary(slug);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounting"
        description="Chart of accounts, journal entries, and trial balance."
      />

      {summary !== null && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KPICard label="Active Accounts" value={String(summary.accountCount)} />
          <KPICard label="Draft Journal Entries" value={String(summary.draftEntries)} />
          <KPICard label="Current Fiscal Year" value={summary.currentFiscalYear ?? "None set"} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODULE_LINKS.map(({ href, icon: Icon, title, description }) => (
          <Link key={href} href={`/${slug}/accounting/${href}`} className="group">
            <Card className="h-full transition-colors group-hover:bg-muted/30">
              <CardContent className="px-5 py-4">
                <Icon className="size-5 text-muted-foreground/70 group-hover:text-primary" />
                <h2 className="mt-3 font-semibold group-hover:text-primary">{title} →</h2>
                <p className="mt-1 text-sm text-muted-foreground">{description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardContent className="px-5 py-4">
          <p className="text-sm text-muted-foreground">
            Goods-receipt and payroll auto-posting are now active once the default account mapping
            is configured in Settings (see DECISIONS_LOG §B/§C).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
