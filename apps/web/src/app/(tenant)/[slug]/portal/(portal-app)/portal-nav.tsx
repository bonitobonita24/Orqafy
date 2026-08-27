"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Receipt,
  Package,
  Wrench,
  LogOut,
} from "@/components/ui/icons";

const NAV_ITEMS = [
  { label: "Dashboard", href: "", icon: LayoutDashboard },
  { label: "Invoices", href: "invoices", icon: Receipt },
  { label: "Orders", href: "orders", icon: Package },
  { label: "Repairs", href: "repairs", icon: Wrench },
] as const;

interface PortalNavProps {
  slug: string;
}

export function PortalNav({ slug }: PortalNavProps) {
  const pathname = usePathname();
  const base = `/${slug}/portal`;

  return (
    <nav data-fdl="portal-nav" className="flex flex-wrap items-center gap-1">
      {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
        const fullHref = href === "" ? base : `${base}/${href}`;
        const isActive = pathname === fullHref || (href !== "" && pathname.startsWith(`${fullHref}/`));
        return (
          <Button
            key={label}
            asChild
            variant={isActive ? "secondary" : "ghost"}
            size="sm"
            className="gap-1.5"
          >
            <Link href={fullHref} aria-current={isActive ? "page" : undefined}>
              <Icon className="size-4" />
              {label}
            </Link>
          </Button>
        );
      })}

      <Button
        variant="ghost"
        size="sm"
        className="ml-auto gap-1.5 text-muted-foreground"
        onClick={() => void signOut({ callbackUrl: `${base}/login` })}
      >
        <LogOut className="size-4" />
        Sign out
      </Button>
    </nav>
  );
}
