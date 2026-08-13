import { type IconType } from "@/components/ui/icons";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
  /** Lucide icon shown above the title. */
  icon: IconType;
  /** Short, primary message — what's missing. */
  title: string;
  /** Optional secondary line — why, or what to do next. */
  description?: string;
  /** Optional call-to-action (button/link) rendered below the copy. */
  action?: React.ReactNode;
  className?: string;
}

/**
 * EmptyState — the genuine shadcn-studio Pro empty-state pattern:
 * a dashed-border panel with a muted icon, a medium title, a muted
 * description, and an optional action. Theme-token only (neutral-dark safe).
 *
 * Use inside a Card/CardContent (or any panel) when a query returns no rows,
 * so empty surfaces read as intentional rather than broken.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-md border border-dashed border-border p-6 text-center",
        className,
      )}
    >
      <Icon className="size-10 text-muted-foreground/60" aria-hidden="true" />
      <p className="mt-3 text-sm font-medium text-foreground">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
