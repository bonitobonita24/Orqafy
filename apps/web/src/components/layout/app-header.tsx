"use client";

import { NotificationBell } from "@/components/layout/notification-bell";

interface AppHeaderProps {
  title?: string;
}

export function AppHeader({ title }: AppHeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-6">
      {title !== undefined && title !== "" ? (
        <h1 className="text-sm font-medium">{title}</h1>
      ) : (
        <div />
      )}

      <div className="flex items-center gap-2">
        {/* D7 — durable Prisma notifications + Valkey real-time fan-out. */}
        <NotificationBell />
      </div>
    </header>
  );
}
