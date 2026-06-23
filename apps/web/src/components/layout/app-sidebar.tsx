"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  Calculator,
  CheckSquare,
  ClipboardList,
  Clock,
  DollarSign,
  FileText,
  FolderOpen,
  HeartHandshake,
  Landmark,
  LayoutDashboard,
  LifeBuoy,
  Package,
  Receipt,
  Settings,
  ShoppingBag,
  ShoppingCart,
  UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Grouped nav — matches mockup IA (section labels + grouped items).
// Colors stay neutral-dark (intentional reskin); structure matches mockup.
const NAV_GROUPS = [
  {
    label: "MAIN",
    items: [
      { label: "Dashboard", href: "dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "CRM / SALES",
    items: [
      { label: "CRM", href: "crm/customers", icon: HeartHandshake },
      { label: "Invoices", href: "invoices", icon: FileText },
    ],
  },
  {
    label: "PURCHASING",
    items: [
      { label: "Purchasing", href: "purchasing", icon: ShoppingBag },
    ],
  },
  {
    label: "INVENTORY",
    items: [
      { label: "Inventory", href: "inventory", icon: Package },
    ],
  },
  {
    label: "PROJECTS & TASKS",
    items: [
      { label: "Projects", href: "projects", icon: FolderOpen },
      { label: "Tasks", href: "tasks", icon: CheckSquare },
    ],
  },
  {
    label: "HR & PAYROLL",
    items: [
      { label: "Employees", href: "employees", icon: UserCheck },
      { label: "DTR", href: "dtr", icon: Clock },
      { label: "Payroll", href: "payroll", icon: DollarSign },
      { label: "Expenses", href: "expenses", icon: Receipt },
    ],
  },
  {
    label: "BANKING & FINANCE",
    items: [
      { label: "Banking", href: "banking", icon: Landmark },
    ],
  },
  {
    label: "ACCOUNTING",
    items: [
      { label: "Accounting", href: "accounting", icon: BookOpen },
      { label: "Reports", href: "reports", icon: BarChart3 },
    ],
  },
  {
    label: "E-COMMERCE & POS",
    items: [
      { label: "Ecommerce", href: "ecommerce/orders", icon: ShoppingCart },
      { label: "POS", href: "pos", icon: Calculator },
    ],
  },
  {
    label: "SUPPORT",
    items: [
      { label: "Support", href: "support", icon: LifeBuoy },
      { label: "Job Orders", href: "job-orders", icon: ClipboardList },
    ],
  },
  {
    label: "SETTINGS",
    items: [
      { label: "Settings", href: "settings", icon: Settings },
    ],
  },
] as const;

interface AppSidebarProps {
  slug: string;
}

export function AppSidebar({ slug }: AppSidebarProps) {
  const pathname = usePathname();

  // bg-muted/30 restores sidebar vs content elevation: mockup used C.carbon (#101010)
  // vs C.abyss (#050507) for the same purpose; bg-card collapses that layering.
  return (
    <aside className="flex h-full w-56 flex-col border-r border-border bg-muted/30">
      {/* Logo — matches mockup header block; color neutral (reskin) */}
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <span
          className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-base font-bold text-primary signal-glow"
        >
          O
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight tracking-tight">Orqafy</p>
          <p className="truncate text-[10px] text-muted-foreground">{slug}</p>
        </div>
      </div>

      {/* Grouped nav — section labels + items, matching mockup IA */}
      <nav className="flex-1 overflow-y-auto py-1.5">
        {NAV_GROUPS.map(({ label: groupLabel, items }) => (
          <div key={groupLabel} className="mb-0.5">
            {/* Section label — uppercase overline; stays flush at px-4 so the
                indented items below read clearly as its children. */}
            <p className="px-4 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-[0.8px] text-muted-foreground/60">
              {groupLabel}
            </p>
            {/* Indented item list with a subtle left connector guide — the Pro
                shadcn-sidebar submenu pattern: children inset from their group
                label + a vertical rule so the hierarchy is unmistakable. */}
            <ul className="ml-[1.375rem] border-l border-border/50">
              {items.map(({ label, href, icon: Icon }) => {
                const fullHref = `/${slug}/${href}`;
                const isActive =
                  pathname === fullHref || pathname.startsWith(`${fullHref}/`);
                return (
                  <li key={href} className="-ml-px">
                    <Link
                      href={fullHref}
                      className={cn(
                        // Left-border accent on active sits ON the connector guide,
                        // so the active child lights up its branch of the tree.
                        // Color stays neutral-dark (intentional reskin, not emerald).
                        "flex items-center gap-2.5 border-l-2 py-1.5 pl-3 pr-3 text-[12.5px] transition-colors",
                        isActive
                          ? "border-primary bg-primary/10 font-semibold text-primary"
                          : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer — "Powered by" attribution matching mockup */}
      <div className="border-t border-border px-4 py-2">
        <p className="text-[10px] text-muted-foreground/50">
          Powered by Powerbyte I.T. Solutions
        </p>
      </div>
    </aside>
  );
}
