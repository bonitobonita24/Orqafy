/**
 * demo-media.ts — seeds images, signatures, and file attachments for the DEMO tenant
 * so every upload/preview surface renders.
 *
 * Three resolution classes (see the app's StorageAdapter + /api/media proxy):
 *   • Class B — raw URL/JSON fields (Tenant.logoUrl, User.avatarUrl,
 *     Product.ecommerceImageUrls, Expense.receiptUrl): set to self-contained
 *     data: URIs so they render on BOTH the public storefront and authed pages
 *     with no external dependency / CSP host allowlist.
 *   • Class C — signatures (Invoice.signatureUrl, JobOrder.customer/technicianSignatureUrl):
 *     base64 PNG data: URIs.
 *   • Class A — real uploaded files (generic Attachment + MediaObject ledger):
 *     rows are created here with DETERMINISTIC storage keys; the matching BYTES
 *     are pushed to MinIO (bucket orqafy-demo) post-seed by filename (see
 *     deploy/seed helper). backend "s3", telegramFileId null ⇒ resolves from MinIO.
 *
 * Idempotent + tenant-scoped. Safe to re-run.
 */

import type { PrismaClient } from '@prisma/client';
import { at } from './demo-seed-utils';
import {
  DEMO_LOGO_DATAURI,
  DEMO_SIGNATURE_DATAURI,
  DEMO_AVATAR_DATAURIS,
  DEMO_PRODUCT_DATAURIS,
  DEMO_FILE_ASSETS,
} from './demo-media-assets';

// entityType (must be in the storage router's ENTITY_TYPES allow-list) → sample file asset
const ATTACHMENT_PLAN: ReadonlyArray<{ entityType: string; asset: keyof typeof DEMO_FILE_ASSETS }> = [
  { entityType: 'expense', asset: 'receipt' },
  { entityType: 'customer', asset: 'contract' },
  { entityType: 'project', asset: 'spec_sheet' },
  { entityType: 'job_order', asset: 'site_photo' },
  { entityType: 'employee', asset: 'id_document' },
  { entityType: 'goods_receipt', asset: 'delivery_photo' },
  { entityType: 'purchase_order', asset: 'contract' },
  { entityType: 'task', asset: 'spec_sheet' },
  { entityType: 'invoice', asset: 'receipt' },
];

// entityType → how to fetch up to N candidate ids for that entity's model
type IdFetcher = (prisma: PrismaClient, tenantId: string, take: number) => Promise<string[]>;
const ID_FETCHERS: Record<string, IdFetcher> = {
  expense: (p, t, n) => p.expense.findMany({ where: { tenantId: t }, take: n, select: { id: true } }).then((r) => r.map((x) => x.id)),
  customer: (p, t, n) => p.customer.findMany({ where: { tenantId: t }, take: n, select: { id: true } }).then((r) => r.map((x) => x.id)),
  project: (p, t, n) => p.project.findMany({ where: { tenantId: t }, take: n, select: { id: true } }).then((r) => r.map((x) => x.id)),
  job_order: (p, t, n) => p.jobOrder.findMany({ where: { tenantId: t }, take: n, select: { id: true } }).then((r) => r.map((x) => x.id)),
  employee: (p, t, n) => p.employee.findMany({ where: { tenantId: t }, take: n, select: { id: true } }).then((r) => r.map((x) => x.id)),
  goods_receipt: (p, t, n) => p.goodsReceipt.findMany({ where: { tenantId: t }, take: n, select: { id: true } }).then((r) => r.map((x) => x.id)),
  purchase_order: (p, t, n) => p.purchaseOrder.findMany({ where: { tenantId: t }, take: n, select: { id: true } }).then((r) => r.map((x) => x.id)),
  task: (p, t, n) => p.task.findMany({ where: { tenantId: t }, take: n, select: { id: true } }).then((r) => r.map((x) => x.id)),
  invoice: (p, t, n) => p.invoice.findMany({ where: { tenantId: t }, take: n, select: { id: true } }).then((r) => r.map((x) => x.id)),
};

export async function seedDemoMedia(
  prisma: PrismaClient,
  tenantId: string,
  tenantSlug: string,
): Promise<void> {
  console.log('🖼️  Seeding demo media (images, signatures, attachments)…');

  // Resolve an uploader user.
  const uploader = await prisma.user.findFirst({
    where: { tenantId, isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!uploader) {
    console.log('  ⏭  No users — skipping media seed.');
    return;
  }
  const uploaderId = uploader.id;

  // ── Class B: Tenant logo ──
  await prisma.tenant.update({ where: { id: tenantId }, data: { logoUrl: DEMO_LOGO_DATAURI } });

  // ── Class B: User avatars (cycle a few) ──
  const users = await prisma.user.findMany({ where: { tenantId }, select: { id: true, avatarUrl: true } });
  for (let i = 0; i < users.length; i++) {
    const u = at(users, i);
    if (u.avatarUrl === null || u.avatarUrl.length === 0) {
      await prisma.user.update({ where: { id: u.id }, data: { avatarUrl: at(DEMO_AVATAR_DATAURIS, i) } });
    }
  }

  // ── Class B: Product images (storefront) ──
  const products = await prisma.product.findMany({ where: { tenantId }, select: { id: true, ecommerceImageUrls: true } });
  for (let i = 0; i < products.length; i++) {
    const pr = at(products, i);
    const cur = pr.ecommerceImageUrls;
    const empty = cur === null || cur === undefined || (Array.isArray(cur) && cur.length === 0);
    if (empty) {
      await prisma.product.update({
        where: { id: pr.id },
        data: { ecommerceImageUrls: [at(DEMO_PRODUCT_DATAURIS, i)] },
      });
    }
  }

  // ── Class B: Expense receipts (image data URI on a few expenses) ──
  const expensesForReceipt = await prisma.expense.findMany({
    where: { tenantId, receiptUrl: null },
    take: 4,
    select: { id: true },
  });
  for (let i = 0; i < expensesForReceipt.length; i++) {
    await prisma.expense.update({
      where: { id: at(expensesForReceipt, i).id },
      data: { receiptUrl: at(DEMO_PRODUCT_DATAURIS, i) },
    });
  }

  // ── Class C: Invoice signatures (on paid invoices) ──
  const paidInvoices = await prisma.invoice.findMany({
    where: { tenantId, status: 'paid', signatureUrl: null },
    take: 4,
    select: { id: true, paidAt: true },
  });
  for (const inv of paidInvoices) {
    await prisma.invoice.update({
      where: { id: inv.id },
      data: {
        signatureUrl: DEMO_SIGNATURE_DATAURI,
        signedAt: inv.paidAt ?? new Date(),
        signerName: 'Authorized Signatory',
        signerIp: '203.0.113.10',
      },
    });
  }

  // ── Class C: Job order signatures (customer + technician) ──
  const jobOrders = await prisma.jobOrder.findMany({
    where: { tenantId, customerSignatureUrl: null },
    take: 3,
    select: { id: true },
  });
  for (const jo of jobOrders) {
    await prisma.jobOrder.update({
      where: { id: jo.id },
      data: {
        customerSignatureUrl: DEMO_SIGNATURE_DATAURI,
        technicianSignatureUrl: DEMO_SIGNATURE_DATAURI,
        signedAt: new Date(),
      },
    });
  }

  // ── Class A: real file attachments (Attachment + MediaObject; bytes uploaded post-seed) ──
  if ((await prisma.attachment.count({ where: { tenantId } })) === 0) {
    let created = 0;
    for (const plan of ATTACHMENT_PLAN) {
      const fetcher = ID_FETCHERS[plan.entityType];
      if (!fetcher) continue;
      let ids: string[] = [];
      try {
        ids = await fetcher(prisma, tenantId, 2);
      } catch {
        ids = [];
      }
      const asset = DEMO_FILE_ASSETS[plan.asset];
      if (!asset) continue;
      for (const entityId of ids) {
        const storageKey = `${tenantSlug}/${plan.entityType}/${entityId}/demo-${asset.filename}`;
        await prisma.attachment.create({
          data: {
            tenantId,
            entityType: plan.entityType,
            entityId,
            storageKey,
            filename: asset.filename,
            mimeType: asset.mimeType,
            sizeBytes: BigInt(asset.sizeBytes),
            uploadedByUserId: uploaderId,
          },
        });
        await prisma.mediaObject.upsert({
          where: { tenantId_storageKey: { tenantId, storageKey } },
          create: {
            tenantId,
            storageKey,
            entityType: plan.entityType,
            backend: 's3',
            sizeBytes: asset.sizeBytes,
            mimeType: asset.mimeType,
          },
          update: {},
        });
        created++;
      }
    }
    console.log(`  ✅ Attachments: ${created} files (Attachment + MediaObject rows; bytes pushed to MinIO post-seed)`);
  } else {
    console.log('  ⏭  Attachments already seeded. Skipping Class A.');
  }

  console.log('  ✅ Demo media seeding complete.');
}
