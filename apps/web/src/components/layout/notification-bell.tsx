"use client";

import { useEffect } from "react";
import { Bell, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationBell() {
  const listQuery = trpc.notification.list.useQuery(
    { limit: 10 },
    { refetchOnWindowFocus: true, refetchInterval: 60_000 }
  );
  const refetchList = listQuery.refetch;

  const markRead = trpc.notification.markRead.useMutation({
    onSuccess: () => {
      void refetchList();
    },
  });
  const markAllRead = trpc.notification.markAllRead.useMutation({
    onSuccess: () => {
      void refetchList();
    },
  });

  // Real-time: subscribe to the SSE stream and refetch on each push. Falls back
  // to the 60s polling above if SSE is unavailable.
  useEffect(() => {
    const source = new EventSource("/api/sse");
    source.onmessage = () => {
      void refetchList();
    };
    source.onerror = () => {
      // EventSource auto-reconnects; nothing to do. Polling remains the fallback.
    };
    return () => source.close();
  }, [refetchList]);

  const items = listQuery.data?.items ?? [];
  const unreadCount = listQuery.data?.unreadCount ?? 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8 text-muted-foreground"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
          <span className="sr-only">Notifications</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm font-medium">Notifications</span>
          {unreadCount > 0 ? (
            <button
              type="button"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Mark all read
            </button>
          ) : null}
        </div>

        <div className="max-h-96 overflow-y-auto">
          {listQuery.isLoading ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              You&apos;re all caught up.
            </p>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  if (!n.isRead) markRead.mutate({ id: n.id });
                }}
                className={cn(
                  "flex w-full items-start gap-2 border-b border-border px-3 py-2.5 text-left last:border-b-0 hover:bg-accent",
                  !n.isRead && "bg-accent/40"
                )}
              >
                <span
                  className={cn(
                    "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                    n.isRead ? "bg-transparent" : "bg-primary"
                  )}
                  aria-hidden
                />
                <span className="flex-1 space-y-0.5">
                  <span className="block text-sm font-medium leading-snug">{n.title}</span>
                  <span className="block text-xs text-muted-foreground leading-snug">{n.body}</span>
                  <span className="block text-[11px] text-muted-foreground/70">
                    {timeAgo(n.createdAt)}
                  </span>
                </span>
                {n.isRead ? (
                  <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/50" aria-hidden />
                ) : null}
              </button>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
