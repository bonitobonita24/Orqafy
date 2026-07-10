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

// Flat nav — section headers removed (owner: the item names are self-explanatory
// and most groups just duplicated their single child, e.g. PURCHASING→Purchasing).
// Each item is its own top-level entry. Colors stay neutral-dark (reskin).
const NAV_ITEMS = [
  { label: "Dashboard", href: "dashboard", icon: LayoutDashboard },
  { label: "CRM", href: "crm/customers", icon: HeartHandshake },
  { label: "Invoices", href: "invoices", icon: FileText },
  { label: "Purchasing", href: "purchasing", icon: ShoppingBag },
  { label: "Inventory", href: "inventory", icon: Package },
  { label: "Projects", href: "projects", icon: FolderOpen },
  { label: "Tasks", href: "tasks", icon: CheckSquare },
  { label: "Employees", href: "employees", icon: UserCheck },
  { label: "DTR", href: "dtr", icon: Clock },
  { label: "Payroll", href: "payroll", icon: DollarSign },
  { label: "Expenses", href: "expenses", icon: Receipt },
  { label: "Banking", href: "banking", icon: Landmark },
  { label: "Accounting", href: "accounting", icon: BookOpen },
  { label: "Reports", href: "reports", icon: BarChart3 },
  { label: "Ecommerce", href: "ecommerce/orders", icon: ShoppingCart },
  { label: "POS", href: "pos", icon: Calculator },
  { label: "Support", href: "support", icon: LifeBuoy },
  { label: "Job Orders", href: "job-orders", icon: ClipboardList },
  { label: "Settings", href: "settings", icon: Settings },
] as const;

interface AppSidebarProps {
  slug: string;
}

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.9.0";

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

      {/* Flat nav — one clean list of items, rounded active highlight. */}
      <nav aria-label="Sidebar" className="flex-1 overflow-y-auto px-2 py-2">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const fullHref = `/${slug}/${href}`;
            const isActive =
              pathname === fullHref || pathname.startsWith(`${fullHref}/`);
            return (
              <li key={href}>
                <Link
                  href={fullHref}
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
    </aside>
  );
}
