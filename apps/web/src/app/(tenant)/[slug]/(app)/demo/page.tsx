import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/server/auth";
import { prisma } from "@orqafy/db";
import {
  LayoutDashboard,
  HeartHandshake,
  FolderOpen,
  FileText,
  Receipt,
  BarChart3,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

export const metadata: Metadata = { title: "Demo Workspace" };
export const dynamic = "force-dynamic";

type Params = { slug: string };

async function getDemoState(slug: string) {
  const [tenant, customers, invoices, expenses, projects, tasks, employees] =
    await Promise.all([
      prisma.tenant.findUnique({
        where: { slug },
        select: { id: true, name: true, slug: true, status: true, createdAt: true },
      }),
      prisma.customer.count(),
      prisma.invoice.count(),
      prisma.expense.count(),
      prisma.project.count(),
      prisma.task.count(),
      prisma.employee.count(),
    ]);
  return { tenant, customers, invoices, expenses, projects, tasks, employees };
}

const TOUR: Array<{ label: string; href: string; icon: typeof FileText; blurb: string }> = [
  { label: "Dashboard", href: "dashboard", icon: LayoutDashboard, blurb: "KPI tiles + recent activity" },
  { label: "CRM", href: "crm/customers", icon: HeartHandshake, blurb: "Customers, proposals, quotations" },
  { label: "Projects", href: "projects", icon: FolderOpen, blurb: "Project tracking + tasks" },
  { label: "Invoices", href: "invoices", icon: FileText, blurb: "Sales invoices + payments" },
  { label: "Expenses", href: "expenses", icon: Receipt, blurb: "Approvals + reimbursements" },
  { label: "Reports", href: "reports", icon: BarChart3, blurb: "Cross-module analytics" },
];

const RESTRICTIONS: string[] = [
  "Cannot change passwords",
  "Cannot delete the demo tenant",
  "Cannot modify tenant settings",
  "Cannot export data",
  "Cannot create additional users",
];

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

export default async function DemoPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const session = await auth();
  const isDemoTenant = session?.user.isDemoTenant === true;

  if (!isDemoTenant) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Demo Workspace</h1>
        <div className="rounded-lg border border-yellow-400/30 bg-yellow-400/10 px-4 py-3 text-sm text-yellow-400">
          This page is only available inside the public demo workspace.
        </div>
      </div>
    );
  }

  const { tenant, customers, invoices, expenses, projects, tasks, employees } =
    await getDemoState(slug);

  const stats: Array<{ label: string; value: number }> = [
    { label: "Customers", value: customers },
    { label: "Invoices", value: invoices },
    { label: "Expenses", value: expenses },
    { label: "Projects", value: projects },
    { label: "Tasks", value: tasks },
    { label: "Employees", value: employees },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium text-primary">Demo Mode</span>
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Welcome to Orqafy</h1>
          <p className="text-sm text-muted-foreground">
            Explore the platform with pre-seeded data. All changes reset automatically every 6 hours.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Workspace</div>
            <div className="mt-1 text-lg font-semibold">{tenant?.name ?? "—"}</div>
            <div className="mt-0.5 font-mono text-xs text-muted-foreground">/{tenant?.slug ?? slug}</div>
          </div>
          <div className="flex items-center gap-4 text-right">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Status</div>
              <span className="mt-1 inline-flex rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {tenant?.status ?? "demo"}
              </span>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Created</div>
              <div className="mt-1 text-sm">{tenant ? formatDate(tenant.createdAt) : "—"}</div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Seeded data</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {stats.map((s) => (
            <div key={s.label} className="rounded-lg border border-border bg-card px-4 py-3">
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Take the tour</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TOUR.map(({ label, href, icon: Icon, blurb }) => (
            <Link
              key={href}
              href={`/${slug}/${href}`}
              className="group flex items-start gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-muted/30"
            >
              <Icon className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <div className="font-medium group-hover:text-primary">{label}</div>
                <div className="text-xs text-muted-foreground">{blurb}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-yellow-400/20 bg-yellow-400/5 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-yellow-400">
          <ShieldAlert className="h-4 w-4" />
          Demo restrictions
        </div>
        <ul className="grid grid-cols-1 gap-1.5 text-xs text-muted-foreground sm:grid-cols-2">
          {RESTRICTIONS.map((r) => (
            <li key={r} className="flex items-start gap-2">
              <span className="mt-1 h-1 w-1 flex-shrink-0 rounded-full bg-yellow-400/60" />
              {r}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <RefreshCw className="h-3.5 w-3.5" />
        Demo data resets every 6 hours. Last seeded {tenant ? formatDate(tenant.createdAt) : "—"}.
      </div>
    </div>
  );
}
