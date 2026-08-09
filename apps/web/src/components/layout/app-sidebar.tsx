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
import { trpc } from "@/lib/trpc";
import type { FeatureKey } from "@orqafy/shared/rbac";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from "@/components/ui/sidebar";

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

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.12.3";

interface AppSidebarProps {
  slug: string;
}

// Desktop + mobile sidebar built on the shadcn `sidebar` primitive
// (SidebarProvider/Sidebar/SidebarContent/SidebarMenu*). Mobile off-canvas
// is handled by the primitive itself (Sheet under the hood) — no separate
// MobileNav component needed.
export function AppSidebar({ slug }: AppSidebarProps) {
  const pathname = usePathname();
  const { data: perms, isPending } = trpc.role.myPermissions.useQuery();
  // Deny-by-default: while permissions are loading, show placeholder rows
  // instead of the full unfiltered list (Rule 11 PATH A — shadcn Skeleton).
  const visibleItems = isPending
    ? []
    : NAV_ITEMS.filter((item) => perms?.view.includes(item.featureKey) ?? false);

  return (
    <Sidebar>
      <SidebarHeader>
        {/* Logo — matches mockup header block; color neutral (reskin) */}
        <div className="flex h-10 items-center gap-2 px-2">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-base font-bold text-primary signal-glow"
          >
            O
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight tracking-tight">Orqafy</p>
            <p className="truncate text-[10px] text-sidebar-foreground/60">{slug}</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {isPending ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <SidebarMenuItem key={i}>
                    <SidebarMenuSkeleton showIcon />
                  </SidebarMenuItem>
                ))
              ) : (
                visibleItems.map(({ label, href, icon: Icon }) => {
                  const fullHref = `/${slug}/${href}`;
                  const isActive =
                    pathname === fullHref || pathname.startsWith(`${fullHref}/`);
                  return (
                    <SidebarMenuItem key={href}>
                      <SidebarMenuButton asChild isActive={isActive} tooltip={label}>
                        <Link href={fullHref} aria-current={isActive ? "page" : undefined}>
                          <Icon />
                          <span>{label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer — version + white-label credit (design-defaults Entry 3) */}
      <SidebarFooter>
        <div className="space-y-0.5 px-2 py-1">
          <p className="text-[10px] text-sidebar-foreground/60">v{APP_VERSION}</p>
          <a
            href="https://www.powerbyteitsolutions.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-[10px] text-sidebar-foreground/60 transition-colors hover:text-sidebar-foreground hover:underline"
          >
            Developed by Powerbyte IT Solutions
          </a>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
