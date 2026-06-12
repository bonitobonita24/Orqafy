import type { Metadata } from "next";
import { ClientsList } from "./clients-list";

export const metadata: Metadata = { title: "Clients" };

export const dynamic = "force-dynamic";

export default async function ClientsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <ClientsList slug={slug} />;
}
