"use client";

import { MobileNav } from "@/components/layout/mobile-nav";
import { NotificationBell } from "@/components/layout/notification-bell";

interface AppHeaderProps {
  title?: string;
  /** Tenant workspace slug — shown as breadcrumb context, matching mockup header IA */
  tenantSlug?: string;
}

export function AppHeader({ title, tenantSlug }: AppHeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-6">
      {/* Left: page title or tenant context */}
      <div className="flex items-center gap-3">
        {tenantSlug !== undefined ? <MobileNav slug={tenantSlug} /> : null}
        {title !== undefined && title !== "" ? (
          <h1 className="text-sm font-medium">{title}</h1>
        ) : tenantSlug !== undefined ? (
          <span className="text-xs text-muted-foreground">{tenantSlug}</span>
        ) : (
          <div />
        )}
      </div>

      {/* Right: tagline + notifications — matches mockup right-side header cluster */}
      <div className="flex items-center gap-4">
        <span className="hidden text-[11px] text-muted-foreground/60 sm:block">
          Move as one.
        </span>
        {/* D7 — durable Prisma notifications + Valkey real-time fan-out. */}
        <NotificationBell />
      </div>
    </header>
  );
}
