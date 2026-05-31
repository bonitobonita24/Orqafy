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
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Dashboard", href: "dashboard", icon: LayoutDashboard },
  { label: "Clients", href: "clients", icon: Users },
  { label: "CRM", href: "crm/customers", icon: HeartHandshake },
  { label: "Projects", href: "projects", icon: FolderOpen },
  { label: "Job Orders", href: "job-orders", icon: ClipboardList },
  { label: "Tasks", href: "tasks", icon: CheckSquare },
  { label: "Support", href: "support", icon: LifeBuoy },
  { label: "Invoices", href: "invoices", icon: FileText },
  { label: "Expenses", href: "expenses", icon: Receipt },
  { label: "Accounting", href: "accounting", icon: BookOpen },
  { label: "Banking", href: "banking", icon: Landmark },
  { label: "Employees", href: "employees", icon: UserCheck },
  { label: "DTR", href: "dtr", icon: Clock },
  { label: "Payroll", href: "payroll", icon: DollarSign },
  { label: "Inventory", href: "inventory", icon: Package },
  { label: "Purchasing", href: "purchasing", icon: ShoppingBag },
  { label: "POS", href: "pos", icon: Calculator },
  { label: "Ecommerce", href: "ecommerce/orders", icon: ShoppingCart },
  { label: "Reports", href: "reports", icon: BarChart3 },
  { label: "Settings", href: "settings", icon: Settings },
] as const;

interface AppSidebarProps {
  slug: string;
}

export function AppSidebar({ slug }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-56 flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <span
          className="flex h-7 w-7 items-center justify-center rounded-md bg-[#00d992]/10 text-base font-bold text-[#00d992]"
          style={{ filter: "drop-shadow(0 0 4px #00d992)" }}
        >
          O
        </span>
        <span className="text-sm font-semibold tracking-tight">Orqafy</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const fullHref = `/${slug}/${href}`;
            const isActive = pathname === fullHref || pathname.startsWith(`${fullHref}/`);
            return (
              <li key={href}>
                <Link
                  href={fullHref}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                    isActive
                      ? "bg-[#00d992]/10 text-[#00d992]"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Tenant slug badge */}
      <div className="border-t border-border px-4 py-3">
        <p className="truncate text-xs text-muted-foreground">{slug}</p>
      </div>
    </aside>
  );
}
