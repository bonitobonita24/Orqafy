import { SidebarNav } from "@/components/layout/sidebar-nav";

interface AppSidebarProps {
  slug: string;
}

// Desktop sidebar — hidden below md; mobile uses MobileNav (off-canvas Sheet).
// bg-muted/30 restores sidebar vs content elevation: mockup used C.carbon (#101010)
// vs C.abyss (#050507) for the same purpose; bg-card collapses that layering.
export function AppSidebar({ slug }: AppSidebarProps) {
  return (
    <aside className="hidden h-full w-56 flex-col border-r border-border bg-muted/30 md:flex">
      <SidebarNav slug={slug} />
    </aside>
  );
}
