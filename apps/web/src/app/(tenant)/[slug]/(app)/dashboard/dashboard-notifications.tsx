"use client";

import { Bell } from "@/components/ui/icons";
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

// D7 — dashboard notifications surface. Reuses notification.list (tenant +
// recipient scoped server-side). Mark-read on click mirrors the header bell.
export function DashboardNotifications() {
  const listQuery = trpc.notification.list.useQuery(
    { limit: 8 },
    { refetchOnWindowFocus: true }
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

  const items = listQuery.data?.items ?? [];
  const unreadCount = listQuery.data?.unreadCount ?? 0;

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Bell className="h-4 w-4 text-muted-foreground" />
          Notifications
          {unreadCount > 0 ? (
            <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-tight text-primary-foreground">
              {unreadCount}
            </span>
          ) : null}
        </h2>
        {unreadCount > 0 ? (
          <button
            type="button"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Mark all read
          </button>
        ) : null}
      </div>

      {listQuery.isLoading ? (
        <div className="px-5 py-8 text-center text-xs text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <div className="px-5 py-8 text-center text-xs text-muted-foreground">
          You&apos;re all caught up.
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => {
                  if (!n.isRead) markRead.mutate({ id: n.id });
                }}
                className={cn(
                  "flex w-full items-start gap-3 px-5 py-3 text-left transition-colors hover:bg-accent",
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
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{n.title}</span>
                  <span className="block text-xs text-muted-foreground">{n.body}</span>
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground/70">
                  {timeAgo(n.createdAt)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
