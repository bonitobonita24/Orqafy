// Shared tenant-branding lookup for the customer-portal public/authed pages
// (login, accept, portal shell). Mirrors the sanitized-lookup shape of
// public-invoice.ts's getPublicInvoiceByToken — returns null on an unknown
// slug so every caller can `notFound()` uniformly instead of leaking a
// distinct "tenant doesn't exist" signal.
import { prisma } from "@orqafy/db";

export interface PortalTenantBranding {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
}

export async function getPortalTenantBranding(
  slug: string,
): Promise<PortalTenantBranding | null> {
  if (!slug || slug.length === 0) {
    return null;
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true, logoUrl: true },
  });

  return tenant;
}
