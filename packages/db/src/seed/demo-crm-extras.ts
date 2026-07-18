/**
 * demo-crm-extras.ts
 *
 * Enriches the DEMO tenant's CRM module beyond the basic Quotation/Proposal/
 * ContactLog rows seeded by demo-showcase.ts's seedCrm(). The customer-detail
 * page's sub-tabs (Contacts, Documents, Credit Account) and the
 * Quotation/Proposal revision-history + public-share-link flows are otherwise
 * never populated — this file gives those sub-flows real rows to demo against.
 * It also creates a `rejected` and an `expired` Quotation so every quotation
 * status filter has at least one matching row.
 *
 * Standalone, additive module: does NOT touch demo-showcase.ts. Run it after
 * seedDemoShowcase() has already created the tenant's Customers, Quotations,
 * and Proposals.
 *
 * TypeScript strict: no `any`. Decimal fields passed as money() strings.
 */

import type { PrismaClient } from '@prisma/client';
import { money, daysAgo, at } from './demo-seed-utils';

export async function seedCrmExtras(prisma: PrismaClient, tenantId: string): Promise<void> {
  // Idempotency guard — CustomerContact is the primary new model this seeds.
  if ((await prisma.customerContact.count({ where: { tenantId } })) > 0) {
    console.log('  ⏭  CRM extras already seeded. Skipping.');
    return;
  }

  const customers = await prisma.customer.findMany({
    where: { tenantId },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
  if (customers.length === 0) {
    console.log('  ⏭  CRM extras: no Customers found for tenant — run seedDemoShowcase() first. Skipping.');
    return;
  }

  const quotations = await prisma.quotation.findMany({
    where: { tenantId },
    select: { id: true, createdById: true },
    orderBy: { createdAt: 'asc' },
  });
  const proposals = await prisma.proposal.findMany({
    where: { tenantId },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });

  let contactsSeeded = 0;
  let documentsSeeded = 0;
  let creditAccountsSeeded = 0;
  let creditTxnsSeeded = 0;
  let quotationRevisionsSeeded = 0;
  let proposalRevisionsSeeded = 0;
  let proposalLinksSeeded = 0;
  let extraQuotationsSeeded = 0;

  // ── 1. CustomerContact — 2-3 per top 2 customers ───────────────────────────
  const contactSeed: Array<{ name: string; email: string; phone: string; position: string }> = [
    { name: 'Maria Santos', email: 'maria.santos@example.ph', phone: '+63 917 234 5678', position: 'Procurement Head' },
    { name: 'Jose Rivera', email: 'jose.rivera@example.ph', phone: '+63 918 345 6789', position: 'Accounts Payable' },
    { name: 'Anna Cruz', email: 'anna.cruz@example.ph', phone: '+63 919 456 7890', position: 'Operations Manager' },
  ];
  for (let ci = 0; ci < Math.min(2, customers.length); ci++) {
    const customer = at(customers, ci);
    const count = ci === 0 ? 3 : 2;
    for (let j = 0; j < count; j++) {
      const c = at(contactSeed, j);
      await prisma.customerContact.create({
        data: {
          tenantId,
          customerId: customer.id,
          name: c.name,
          email: c.email,
          phone: c.phone,
          position: c.position,
          isPrimary: j === 0,
        },
      });
      contactsSeeded++;
    }
  }

  // ── 2. CustomerDocument — 1-2 per customer ──────────────────────────────────
  const docSeed: Array<{ title: string; description: string; fileName: string; mimeType: string; sizeKb: number }> = [
    { title: 'BIR 2303', description: 'Certificate of Registration', fileName: 'bir-2303.pdf', mimeType: 'application/pdf', sizeKb: 240 },
    { title: 'Signed MSA', description: 'Master Service Agreement, signed copy', fileName: 'msa-signed.pdf', mimeType: 'application/pdf', sizeKb: 512 },
  ];
  for (let ci = 0; ci < customers.length; ci++) {
    const customer = at(customers, ci);
    const docCount = 1 + (ci % 2);
    for (let j = 0; j < docCount; j++) {
      const d = at(docSeed, j);
      await prisma.customerDocument.create({
        data: {
          tenantId,
          customerId: customer.id,
          title: d.title,
          description: d.description,
          fileName: d.fileName,
          fileUrl: `https://demo-assets.orqafy.app/customers/${customer.id}/${d.fileName}`,
          fileSizeBytes: d.sizeKb * 1024,
          mimeType: d.mimeType,
        },
      });
      documentsSeeded++;
    }
  }

  // ── 3. CustomerCreditAccount + transactions — every 2nd customer ───────────
  for (let ci = 0; ci < customers.length; ci += 2) {
    const customer = at(customers, ci);
    const creditLimit = 100000;
    let balance = 0;
    const account = await prisma.customerCreditAccount.create({
      data: {
        tenantId,
        customerId: customer.id,
        creditLimit: money(creditLimit),
        currentBalance: money(0),
        isActive: true,
        approvedAt: daysAgo(60),
      },
    });
    creditAccountsSeeded++;

    const txns: Array<{ type: string; amount: number; daysBack: number; notes: string }> = [
      { type: 'charge', amount: 32500, daysBack: 20, notes: 'Invoice charge — office equipment order' },
      { type: 'payment', amount: 20000, daysBack: 12, notes: 'Partial payment received via bank transfer' },
      { type: 'charge', amount: 8750, daysBack: 4, notes: 'Invoice charge — consumables restock' },
    ];
    for (const t of txns) {
      balance = t.type === 'payment' ? balance - t.amount : balance + t.amount;
      await prisma.customerCreditTransaction.create({
        data: {
          tenantId,
          creditAccountId: account.id,
          type: t.type,
          amount: money(t.amount),
          runningBalance: money(balance),
          referenceType: 'manual',
          notes: t.notes,
          createdAt: daysAgo(t.daysBack),
        },
      });
      creditTxnsSeeded++;
    }
    await prisma.customerCreditAccount.update({
      where: { id: account.id },
      data: { currentBalance: money(balance) },
    });
  }

  // ── 4. QuotationRevision — on the first existing quotation ─────────────────
  if (quotations.length > 0) {
    const q = at(quotations, 0);
    await prisma.quotationRevision.create({
      data: {
        tenantId,
        quotationId: q.id,
        revisionNumber: 1,
        snapshot: { note: 'Initial pricing revision captured before customer requested a discount adjustment.' },
        createdAt: daysAgo(8),
      },
    });
    quotationRevisionsSeeded++;
  }

  // ── 5. ProposalRevision + ProposalLink — on the first existing proposal ────
  if (proposals.length > 0) {
    const p = at(proposals, 0);
    await prisma.proposalRevision.create({
      data: {
        tenantId,
        proposalId: p.id,
        revisionNumber: 1,
        changes: { note: 'Scope narrowed to phase 1 deliverables per client feedback.' },
        createdAt: daysAgo(10),
      },
    });
    proposalRevisionsSeeded++;

    await prisma.proposalLink.create({
      data: {
        tenantId,
        proposalId: p.id,
        title: 'Public proposal share link',
        url: `https://demo.orqafy.app/p/${p.id}`,
        createdAt: daysAgo(9),
      },
    });
    proposalLinksSeeded++;
  }

  // ── 6. Rejected + expired Quotation — new rows so all status filters work ──
  const extraPrefix = 'DEMO-QUO-EXTRA-';
  const extraExisting = await prisma.quotation.count({
    where: { tenantId, quotationNumber: { startsWith: extraPrefix } },
  });
  if (extraExisting === 0 && quotations.length > 0) {
    const fallback = at(quotations, 0);
    const extraStatuses: Array<{ status: string; suffix: string; subtotal: number; title: string; notes: string; sentDaysBack: number; validDaysBack: number }> = [
      {
        status: 'rejected',
        suffix: '0001',
        subtotal: 45000,
        title: 'Warehouse Racking System — Declined',
        notes: 'Customer opted for a competing vendor.',
        sentDaysBack: 15,
        validDaysBack: -20,
      },
      {
        status: 'expired',
        suffix: '0002',
        subtotal: 62000,
        title: 'Fleet GPS Tracking — Lapsed Offer',
        notes: 'Validity period lapsed without response.',
        sentDaysBack: 35,
        validDaysBack: 5,
      },
    ];
    for (let i = 0; i < extraStatuses.length; i++) {
      const e = at(extraStatuses, i);
      const customer = at(customers, i);
      const tax = Math.round(e.subtotal * 0.12);
      await prisma.quotation.create({
        data: {
          tenantId,
          quotationNumber: `${extraPrefix}${e.suffix}`,
          customerId: customer.id,
          createdById: fallback.createdById,
          title: e.title,
          status: e.status,
          validUntil: daysAgo(e.validDaysBack),
          subtotal: money(e.subtotal),
          taxAmount: money(tax),
          totalAmount: money(e.subtotal + tax),
          currency: 'PHP',
          notes: e.notes,
          sentAt: daysAgo(e.sentDaysBack),
        },
      });
      extraQuotationsSeeded++;
    }
  }

  console.log(
    `  ✅ CRM extras: ${contactsSeeded} contacts, ${documentsSeeded} documents, ${creditAccountsSeeded} credit accounts ` +
      `(+${creditTxnsSeeded} transactions), ${quotationRevisionsSeeded} quotation revision, ` +
      `${proposalRevisionsSeeded} proposal revision, ${proposalLinksSeeded} proposal link, ` +
      `${extraQuotationsSeeded} extra quotations (rejected/expired)`,
  );
}
