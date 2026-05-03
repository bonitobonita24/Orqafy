import type { Metadata } from "next";

export const metadata: Metadata = { title: "Orqafy" };

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
