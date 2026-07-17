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
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import type { FeatureKey } from "@orqafy/shared/rbac";

// Flat nav — section headers removed (owner: the item names are self-explanatory
// and most groups just duplicated their single child, e.g. PURCHASING→Purchasing).
// Each item is its own top-level entry. Colors stay neutral-dark (reskin).
// featureKey ties each item to the RBAC permission matrix `view` grant
// (tenant-rbac-standard §4, Surface 3 — sidebar nav filtered by role.myPermissions).
const NAV_ITEMS = [
  { label: "Dashboard", href: "dashboard", icon: LayoutDashboard, featureKey: "dashboard" },
  { label: "CRM", href: "crm/customers", icon: HeartHandshake, featureKey: "crm" },
  { label: "Invoices", href: "invoices", icon: FileText, featureKey: "invoices" },
  { label: "Purchasing", href: "purchasing", icon: ShoppingBag, featureKey: "purchasing" },
  { label: "Inventory", href: "inventory", icon: Package, featureKey: "inventory" },
  { label: "Projects", href: "projects", icon: FolderOpen, featureKey: "projects" },
  { label: "Tasks", href: "tasks", icon: CheckSquare, featureKey: "tasks" },
  { label: "Employees", href: "employees", icon: UserCheck, featureKey: "employees" },
  { label: "DTR", href: "dtr", icon: Clock, featureKey: "dtr" },
  { label: "Payroll", href: "payroll", icon: DollarSign, featureKey: "payroll" },
  { label: "Expenses", href: "expenses", icon: Receipt, featureKey: "expenses" },
  { label: "Banking", href: "banking", icon: Landmark, featureKey: "banking" },
  { label: "Accounting", href: "accounting", icon: BookOpen, featureKey: "accounting" },
  { label: "Reports", href: "reports", icon: BarChart3, featureKey: "reports" },
  { label: "Ecommerce", href: "ecommerce/orders", icon: ShoppingCart, featureKey: "storefront" },
  { label: "POS", href: "pos", icon: Calculator, featureKey: "pos" },
  { label: "Support", href: "support", icon: LifeBuoy, featureKey: "support" },
  { label: "Job Orders", href: "job-orders", icon: ClipboardList, featureKey: "job_orders" },
  { label: "Settings", href: "settings", icon: Settings, featureKey: "settings" },
] as const satisfies readonly { label: string; href: string; icon: typeof LayoutDashboard; featureKey: FeatureKey }[];

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.9.0";

interface SidebarNavProps {
  slug: string;
  onNavigate?: () => void;
}

// Shared sidebar content — rendered inside the desktop <aside> (app-sidebar.tsx)
// and inside the mobile off-canvas Sheet (mobile-nav.tsx). Root has no
// width/border/bg so both wrappers can supply their own chrome.
export function SidebarNav({ slug, onNavigate }: SidebarNavProps) {
  const pathname = usePathname();
  const { data: perms, isPending } = trpc.role.myPermissions.useQuery();
  // Deny-by-default: while permissions are loading, show placeholder rows
  // instead of the full unfiltered list (Rule 11 PATH A — shadcn Skeleton).
  const visibleItems = isPending
    ? []
    : NAV_ITEMS.filter((item) => perms?.view.includes(item.featureKey) ?? false);

  return (
    <div className="flex h-full flex-col">
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

      {/* Flat nav — one clean list of items, rounded active highlight. */}
      <nav aria-label="Sidebar" className="flex-1 overflow-y-auto px-2 py-2">
        {isPending ? (
          <ul className="space-y-0.5" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="flex items-center gap-2.5 px-3 py-2">
                <Skeleton className="h-4 w-4 shrink-0 rounded" />
                <Skeleton className="h-3.5 w-24 rounded" />
              </li>
            ))}
          </ul>
        ) : (
        <ul className="space-y-0.5">
          {visibleItems.map(({ label, href, icon: Icon }) => {
            const fullHref = `/${slug}/${href}`;
            const isActive =
              pathname === fullHref || pathname.startsWith(`${fullHref}/`);
            return (
              <li key={href}>
                <Link
                  href={fullHref}
                  onClick={() => onNavigate?.()}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] transition-colors",
                    isActive
                      ? "bg-primary/10 font-semibold text-primary"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
        )}
      </nav>

      {/* Footer — version + white-label credit (design-defaults Entry 3) */}
      <div className="space-y-0.5 border-t border-border px-4 py-2">
        <p className="text-[10px] text-muted-foreground">v{APP_VERSION}</p>
        <a
          href="https://www.powerbyteitsolutions.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="block text-[10px] text-muted-foreground transition-colors hover:text-foreground hover:underline"
        >
          Developed by Powerbyte IT Solutions
        </a>
      </div>
    </div>
  );
}
