import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";
import {
  ContactLogTimeline,
  type ContactLogEntry,
} from "./contact-log-timeline";
import { QuickAddContactLog } from "./quick-add-contact-log";

export const metadata: Metadata = { title: "Customer Detail" };

export const dynamic = "force-dynamic";

async function getCustomer(id: string) {
  return prisma.customer.findUnique({
    where: { id },
    include: {
      contacts: { orderBy: { isPrimary: "desc" } },
      creditAccount: true,
    },
  });
}

async function getContactLogs(customerId: string): Promise<ContactLogEntry[]> {
  return prisma.contactLog.findMany({
    where: { customerId },
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
  authorized_dealer: "text-[#00d992] bg-[#00d992]/10 border-[#00d992]/30",
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CustomerDetailPage({ params }: Props) {
  const { id } = await params;
  const customer = await getCustomer(id);

  if (customer === null) notFound();

  const contactLogs = await getContactLogs(customer.id);

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
            <span className="rounded-full border border-[#00d992]/30 bg-[#00d992]/10 px-2 py-0.5 text-xs font-medium text-[#00d992]">
              Active
            </span>
          ) : (
            <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              Inactive
            </span>
          )}
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
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-sm font-semibold">
            Contacts
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {customer.contacts.length}
            </span>
          </h2>
        </div>
        {customer.contacts.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-muted-foreground">
            No contacts added yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Position</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Phone</th>
              </tr>
            </thead>
            <tbody>
              {customer.contacts.map((contact) => (
                <tr
                  key={contact.id}
                  className="border-b border-border last:border-0 transition-colors hover:bg-muted/30"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{contact.name}</span>
                      {contact.isPrimary && (
                        <span className="rounded-full border border-[#00d992]/30 bg-[#00d992]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#00d992]">
                          Primary
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {contact.position !== null ? contact.position : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {contact.email !== null ? contact.email : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {contact.phone !== null ? contact.phone : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Credit Account */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Credit Account
        </h2>
        {customer.creditAccount === null ? (
          <p className="text-sm text-muted-foreground">
            No credit account configured.
          </p>
        ) : (
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Credit Limit</dt>
              <dd className="mt-0.5 text-sm font-medium">
                ₱{Number(customer.creditAccount.creditLimit).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Current Balance</dt>
              <dd className="mt-0.5 text-sm font-medium">
                ₱{Number(customer.creditAccount.currentBalance).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Status</dt>
              <dd className="mt-0.5">
                {customer.creditAccount.isActive ? (
                  <span className="rounded-full border border-[#00d992]/30 bg-[#00d992]/10 px-2 py-0.5 text-xs font-medium text-[#00d992]">
                    Active
                  </span>
                ) : (
                  <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    Inactive
                  </span>
                )}
              </dd>
            </div>
          </dl>
        )}
      </div>

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
