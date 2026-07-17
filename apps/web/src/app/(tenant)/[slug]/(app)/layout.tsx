import type { Metadata } from "next";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { ContentContainer } from "@/components/layout/content-container";

export const metadata: Metadata = { title: "Orqafy" };

interface AppLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export default async function AppLayout({ children, params }: AppLayoutProps) {
  const { slug } = await params;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar slug={slug} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AppHeader tenantSlug={slug} />
        <main className="flex-1 overflow-y-auto py-6">
          <ContentContainer>{children}</ContentContainer>
        </main>
      </div>
    </div>
  );
}
