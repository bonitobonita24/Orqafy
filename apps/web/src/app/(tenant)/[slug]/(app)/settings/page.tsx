import type { Metadata } from "next";
import Link from "next/link";
import { Building2, CreditCard, FolderTree, Mail, Tag, Users } from "lucide-react";
import { prisma } from "@orqafy/db";

export const metadata: Metadata = { title: "Settings" };

export const dynamic = "force-dynamic";

const CARDS = [
  {
    key: "account",
    icon: Building2,
    title: "Account & Tenant",
    description: "General workspace info, plan, billing.",
    live: false,
    href: null,
  },
  {
    key: "users",
    icon: Users,
    title: "Users",
    description: "Manage team members, roles, and permissions.",
    live: false,
    href: "settings/users",
  },
  {
    key: "departments",
    icon: FolderTree,
    title: "Departments",
    description: "Organize your team by department.",
    live: false,
    href: "settings/departments",
  },
  {
    key: "expense-categories",
    icon: Tag,
    title: "Expense Categories",
    description: "Categorize expenses for reporting and accounting.",
    live: false,
    href: "settings/expense-categories",
  },
  {
    key: "smtp",
    icon: Mail,
    title: "SMTP",
    description: "Configure email delivery for invoices and notifications.",
    live: false,
    href: "settings/smtp",
  },
  {
    key: "xendit",
    icon: CreditCard,
    title: "Xendit Payments",
    description: "Accept online payments via Xendit (Philippines, SEA).",
    live: true,
    href: "settings/xendit",
  },
] as const;

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true, status: true },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Workspace configuration. Admin and tenant super admin only.
        </p>
      </div>

      {/* Workspace context card */}
      <div className="rounded-lg border border-border bg-card px-6 py-5">
        <p className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Workspace
        </p>
        <div className="flex flex-wrap gap-8">
          <div>
            <p className="text-xs text-muted-foreground">Name</p>
            <p className="mt-0.5 font-medium">{tenant?.name ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Slug</p>
            <p className="mt-0.5 font-mono text-xs">{tenant?.slug ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <div className="mt-0.5">
              {tenant?.status === "active" ? (
                <span className="rounded-full border border-[#00d992]/30 bg-[#00d992]/10 px-2 py-0.5 text-xs font-medium text-[#00d992]">
                  Active
                </span>
              ) : (
                <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {tenant?.status ?? "—"}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Configuration areas */}
      <div>
        <p className="mb-3 text-sm font-medium text-muted-foreground">
          Configuration areas
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CARDS.map((card) => {
            const Icon = card.icon;
            const inner = (
              <div className="flex h-full flex-col rounded-lg border border-border bg-card p-5 transition-colors hover:bg-muted/20">
                <Icon className="h-5 w-5 text-muted-foreground" />
                <p className="mt-3 font-medium">{card.title}</p>
                <p className="mt-1 flex-1 text-sm text-muted-foreground">
                  {card.description}
                </p>
                <div className="mt-4 flex justify-end">
                  {card.live ? (
                    <span className="rounded-full border border-[#00d992]/30 bg-[#00d992]/10 px-2 py-0.5 text-xs font-medium text-[#00d992]">
                      Live
                    </span>
                  ) : (
                    <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      Coming soon
                    </span>
                  )}
                </div>
              </div>
            );

            return card.live && card.href !== null ? (
              <Link key={card.key} href={card.href}>
                {inner}
              </Link>
            ) : (
              <div key={card.key}>{inner}</div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
