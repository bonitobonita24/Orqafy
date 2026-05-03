"use client";

import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

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
        {/* Notification bell — wired to /api/trpc/notification.list in Phase 8 */}
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
          <Bell className="h-4 w-4" />
          <span className="sr-only">Notifications</span>
        </Button>
      </div>
    </header>
  );
}
