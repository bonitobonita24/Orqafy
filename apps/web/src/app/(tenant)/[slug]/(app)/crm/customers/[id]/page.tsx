import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";
import {
  ContactLogTimeline,
  type ContactLogEntry,
} from "./contact-log-timeline";
import { QuickAddContactLog } from "./quick-add-contact-log";
import { CustomerToggleActive } from "./customer-toggle-active";
import { ContactsPanel } from "./contacts-panel";
import { CreditPanel } from "./credit-panel";
import { CustomerAttachments } from "./customer-attachments";

export const metadata: Metadata = { title: "Customer Detail" };

export const dynamic = "force-dynamic";

async function getCustomer(id: string, tenantId: string) {
  return prisma.customer.findFirst({
    where: { id, tenantId },
    include: {
      contacts: { orderBy: { isPrimary: "desc" } },
      creditAccount: true,
    },
  });
}

async function getContactLogs(
  customerId: string,
  tenantId: string,
): Promise<ContactLogEntry[]> {
  return prisma.contactLog.findMany({
    where: { customerId, tenantId },
    orderBy: { occurredAt: "desc" },
    take: 20,
    include: {
      createdBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          displayName: true,
        },
      },
    },
  });
}

const TIER_LABELS: Record<string, string> = {
  regular: "Regular",
  vip: "VIP",
  authorized_dealer: "Authorized Dealer",
};

const TIER_COLORS: Record<string, string> = {
  regular: "text-muted-foreground bg-muted border-border",
  vip: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  authorized_dealer: "text-primary bg-primary/10 border-primary/30",
};

interface Props {
  params: Promise<{ slug: string; id: string }>;
}

export default async function CustomerDetailPage({ params }: Props) {
  const { slug, id } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!tenant) notFound();
  const customer = await getCustomer(id, tenant.id);

  if (customer === null) notFound();

  const contactLogs = await getContactLogs(customer.id, tenant.id);

  const tierClass =
    TIER_COLORS[customer.tier] ??
    "text-muted-foreground bg-muted border-border";
  const tierLabel = TIER_LABELS[customer.tier] ?? customer.tier;
  const fullName = `${customer.firstName} ${customer.lastName}`;

  const location =
    customer.city !== null && customer.province !== null
      ? `${customer.city}, ${customer.province}`
      : customer.city !== null
        ? customer.city
        : customer.province !== null
          ? customer.province
          : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {customer.companyName !== null ? customer.companyName : fullName}
          </h1>
          {customer.companyName !== null && (
            <p className="text-sm text-muted-foreground">{fullName}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full border px-2 py-0.5 text-xs font-medium ${tierClass}`}
          >
            {tierLabel}
          </span>
          {customer.isActive ? (
            <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              Active
            </span>
          ) : (
            <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              Inactive
            </span>
          )}
          <Link
            href={`/${slug}/crm/customers/${customer.id}/edit`}
            className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
          >
            Edit
          </Link>
          <CustomerToggleActive
            customerId={customer.id}
            isActive={customer.isActive}
          />
        </div>
      </div>

      {/* Customer Info */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Customer Information
        </h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {customer.email !== null && (
            <div>
              <dt className="text-xs text-muted-foreground">Email</dt>
              <dd className="mt-0.5 text-sm">{customer.email}</dd>
            </div>
          )}
          {customer.phone !== null && (
            <div>
              <dt className="text-xs text-muted-foreground">Phone</dt>
              <dd className="mt-0.5 text-sm">{customer.phone}</dd>
            </div>
          )}
          {location !== null && (
            <div>
              <dt className="text-xs text-muted-foreground">Location</dt>
              <dd className="mt-0.5 text-sm">{location}</dd>
            </div>
          )}
          {customer.address !== null && (
            <div>
              <dt className="text-xs text-muted-foreground">Address</dt>
              <dd className="mt-0.5 text-sm">{customer.address}</dd>
            </div>
          )}
          {customer.postalCode !== null && (
            <div>
              <dt className="text-xs text-muted-foreground">Postal Code</dt>
              <dd className="mt-0.5 text-sm">{customer.postalCode}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-muted-foreground">Country</dt>
            <dd className="mt-0.5 text-sm">{customer.country}</dd>
          </div>
          {customer.taxId !== null && (
            <div>
              <dt className="text-xs text-muted-foreground">Tax ID</dt>
              <dd className="mt-0.5 text-sm">{customer.taxId}</dd>
            </div>
          )}
        </dl>
        {customer.notes !== null && (
          <div className="mt-4 border-t border-border pt-4">
            <dt className="text-xs text-muted-foreground">Notes</dt>
            <dd className="mt-0.5 text-sm text-muted-foreground">
              {customer.notes}
            </dd>
          </div>
        )}
      </div>

      {/* Contacts */}
      <ContactsPanel
        customerId={customer.id}
        initialContacts={customer.contacts}
      />

      {/* Credit Account */}
      <CreditPanel
        customerId={customer.id}
        creditAccount={
          customer.creditAccount !== null
            ? {
                creditLimit: Number(customer.creditAccount.creditLimit),
                currentBalance: Number(customer.creditAccount.currentBalance),
                isActive: customer.creditAccount.isActive,
              }
            : null
        }
      />

      {/* Attachments */}
      <section className="mt-6 rounded-lg border border-border bg-card p-6">
        <CustomerAttachments customerId={customer.id} />
      </section>

      {/* Touchpoints */}
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-sm font-semibold">
            Touchpoints
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {contactLogs.length}
            </span>
          </h2>
          <QuickAddContactLog customerId={customer.id} />
        </div>
        <div className="px-6 py-4">
          <ContactLogTimeline initialLogs={contactLogs} />
        </div>
      </div>
    </div>
  );
}
