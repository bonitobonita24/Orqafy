import { cn } from "@/lib/utils";

interface PageHeaderProps {
  /** Page title — rendered as the h1. */
  title: string;
  /** Optional muted subtitle/description line below the title. */
  description?: React.ReactNode;
  /**
   * Optional right-aligned actions slot (buttons/badges/links).
   * ⚠ RSC-SAFE: pass already-rendered elements (e.g. `<Button asChild>…</Button>`),
   * never a function or unrendered component reference — server components
   * cannot pass functions across the server→client boundary.
   */
  actions?: React.ReactNode;
  className?: string;
  /** Optional extra classes merged onto the h1 (e.g. `font-mono` for an ID-style title). */
  titleClassName?: string;
}

/**
 * PageHeader — the reusable AdminCN-style page header used across CRUD
 * module pages (list / detail / form). Presentational only: a title, an
 * optional muted description, and a right-aligned actions slot. Server-
 * component safe — no client-only hooks, no function props.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
  titleClassName,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center",
        className,
      )}
    >
      <div>
        <h1 className={cn("text-2xl font-bold tracking-tight", titleClassName)}>
          {title}
        </h1>
        {description !== undefined ? (
          <div className="mt-1 text-sm text-muted-foreground">{description}</div>
        ) : null}
      </div>
      {actions !== undefined ? (
        <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
