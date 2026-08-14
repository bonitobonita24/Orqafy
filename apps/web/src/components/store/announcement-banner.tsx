import { Fragment } from "react";

interface AnnouncementBannerProps {
  items: { id: string; title: string }[];
}

/**
 * Adapted from starter/shopix announcement-banner.tsx — the Shopix reference
 * uses a Marquee component (not present in this app's shadcn/ui set) with
 * seamless infinite scroll; kept to a static, non-animated bar here to avoid
 * pulling a new dependency. Data-driven from MerchContent(kind="announcement").
 */
export function AnnouncementBanner({ items }: AnnouncementBannerProps): React.ReactNode {
  if (items.length === 0) return null;

  return (
    <div data-fdl="store-announcement" className="w-full bg-foreground">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-6 gap-y-1 px-4 py-1.5">
        {items.map((item, index) => (
          <Fragment key={item.id}>
            <p className="text-xs font-medium whitespace-nowrap text-background sm:text-sm">
              {item.title}
            </p>
            {index < items.length - 1 ? (
              <span className="hidden text-background/40 sm:inline">•</span>
            ) : null}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
