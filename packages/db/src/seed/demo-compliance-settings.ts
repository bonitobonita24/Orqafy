/**
 * demo-compliance-settings.ts
 *
 * Enriches the DEMO tenant's compliance/settings surfaces so a reviewer sees:
 *  - BreachRecord (NPC 72-hour + 5-business-day incident tracking)
 *  - DataSubjectRequest (RA 10173 access/rectify/erase/port/object/inform)
 *  - TenantSmtpConfig (Settings → Email)
 *  - TenantXenditConfig (Settings → Payments)
 *
 * ── ENCRYPTED FIELDS (passwordEnc / secretKeyEnc / webhookTokenEnc) ────────
 * TenantSmtpConfig.passwordEnc and TenantXenditConfig.secretKeyEnc /
 * webhookTokenEnc use the app's AES-256-GCM scheme (apps/web/src/lib/crypto.ts,
 * node:crypto only, keyed by APP_ENCRYPTION_KEY — base64, 32 raw bytes). This
 * seed file duplicates that exact scheme locally (packages/db must not import
 * from apps/web) so demo credentials round-trip through the real app decrypt
 * path. If APP_ENCRYPTION_KEY is not set in the seed's environment, or is not
 * a valid 32-byte base64 key, both TenantSmtpConfig and TenantXenditConfig are
 * SKIPPED (all their sensitive columns are non-nullable — there is no safe
 * partial-seed for them) with a logged reason. BreachRecord and
 * DataSubjectRequest have no encrypted columns and always seed.
 *
 * ── SAFE TO RE-RUN (idempotent) ────────────────────────────────────────────
 * Each block is guarded by a per-tenant existence check on its own model.
 *
 * TypeScript strict: no `any`.
 */

import type { PrismaClient } from '@prisma/client';
import { createCipheriv, randomBytes } from 'node:crypto';
import { daysAgo, dateAgo, at, num } from './demo-seed-utils';

// ── Local mirror of apps/web/src/lib/crypto.ts encrypt() ────────────────────
// Kept in lock-step with that file. packages/db cannot import from apps/web
// (workspace boundary), so the AES-256-GCM scheme is duplicated here.
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const ENCODING = 'base64url' as const;

function getEncryptionKeyOrNull(): Buffer | null {
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (raw === undefined || raw === '') {
    return null;
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== KEY_LENGTH) {
    return null;
  }
  return key;
}

function encryptWithKey(key: Buffer, plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return (
    iv.toString(ENCODING) + '.' + authTag.toString(ENCODING) + '.' + ciphertext.toString(ENCODING)
  );
}

// ── Compliance: BreachRecord + DataSubjectRequest ────────────────────────────

async function seedBreachRecords(
  prisma: PrismaClient,
  tenantId: string,
  users: Array<{ id: string }>,
): Promise<void> {
  if ((await prisma.breachRecord.count({ where: { tenantId } })) > 0) {
    console.log('  ⏭  BreachRecord already seeded. Skipping.');
    return;
  }
  const reporter = at(users, 0);
  const records = [
    {
      title: 'Laptop theft — HR department',
      description:
        'An HR staff laptop containing employee 201 files (names, addresses, contact numbers) was stolen from a parked vehicle. Laptop was password-protected but not full-disk encrypted.',
      discoveredAt: daysAgo(45),
      severity: 'high',
      affectedSubjects: 38,
      npcNotifiedAt: daysAgo(44),
      subjectsNotifiedAt: daysAgo(43),
      fullReportDueAt: daysAgo(38),
      fullReportFiledAt: daysAgo(39),
      status: 'closed',
    },
    {
      title: 'Misdirected invoice email — single customer',
      description:
        'A finance staff member sent an invoice PDF containing one customer\'s billing address and order history to the wrong recipient email address. Recipient confirmed deletion; no further disclosure detected.',
      discoveredAt: daysAgo(6),
      severity: 'low',
      affectedSubjects: 1,
      npcNotifiedAt: null,
      subjectsNotifiedAt: daysAgo(5),
      fullReportDueAt: null,
      fullReportFiledAt: null,
      status: 'reported',
    },
  ];
  for (const r of records) {
    await prisma.breachRecord.create({
      data: {
        tenantId,
        title: r.title,
        description: r.description,
        discoveredAt: r.discoveredAt,
        severity: r.severity,
        affectedSubjects: r.affectedSubjects,
        npcNotifiedAt: r.npcNotifiedAt,
        subjectsNotifiedAt: r.subjectsNotifiedAt,
        fullReportDueAt: r.fullReportDueAt,
        fullReportFiledAt: r.fullReportFiledAt,
        status: r.status,
        reportedById: reporter.id,
      },
    });
  }
  console.log(`  ✅ BreachRecord: ${records.length} records (1 closed + NPC-reported, 1 open low-severity)`);
}

async function seedDataSubjectRequests(
  prisma: PrismaClient,
  tenantId: string,
  users: Array<{ id: string }>,
): Promise<void> {
  if ((await prisma.dataSubjectRequest.count({ where: { tenantId } })) > 0) {
    console.log('  ⏭  DataSubjectRequest already seeded. Skipping.');
    return;
  }
  const handler = at(users, 1);
  const requests = [
    {
      type: 'access',
      status: 'completed',
      subjectEmail: 'maria.delacruz@gmail.com',
      details: { note: 'Customer requested a copy of all personal data held.' },
      resolution: 'Data export (JSON) provided via secure download link on ' + dateAgo(10).toISOString().slice(0, 10) + '.',
      createdAt: daysAgo(14),
      resolvedAt: daysAgo(10),
      handledById: handler.id,
    },
    {
      type: 'erase',
      status: 'in_progress',
      subjectEmail: 'juan.santos@yahoo.com',
      details: { note: 'Former customer requested account and order history deletion.' },
      resolution: null,
      createdAt: daysAgo(3),
      resolvedAt: null,
      handledById: handler.id,
    },
    {
      type: 'rectify',
      status: 'pending',
      subjectEmail: 'angelica.reyes@outlook.com',
      details: { note: 'Customer reports billing address on file is outdated.' },
      resolution: null,
      createdAt: daysAgo(1),
      resolvedAt: null,
      handledById: null,
    },
  ];
  for (let i = 0; i < requests.length; i++) {
    const r = at(requests, i);
    const requester = at(users, i);
    await prisma.dataSubjectRequest.create({
      data: {
        tenantId,
        userId: requester.id,
        type: r.type,
        status: r.status,
        details: { requestRef: `DSR-${num(i + 1)}`, subjectEmail: r.subjectEmail, ...r.details },
        resolution: r.resolution,
        handledById: r.handledById,
        createdAt: r.createdAt,
        resolvedAt: r.resolvedAt,
      },
    });
  }
  console.log(`  ✅ DataSubjectRequest: ${requests.length} requests (access/completed, erase/in_progress, rectify/pending)`);
}

// ── Settings: TenantSmtpConfig ───────────────────────────────────────────────

async function seedSmtpConfig(prisma: PrismaClient, tenantId: string, key: Buffer | null): Promise<boolean> {
  const existing = await prisma.tenantSmtpConfig.count({ where: { tenantId } });
  if (existing > 0) {
    console.log('  ⏭  TenantSmtpConfig already seeded. Skipping.');
    return true;
  }
  if (key === null) {
    console.log(
      '  ⚠️  TenantSmtpConfig SKIPPED — APP_ENCRYPTION_KEY not set (or not a valid 32-byte base64 key) in the seed environment; passwordEnc is a required column so it cannot be safely seeded without it.',
    );
    return false;
  }
  await prisma.tenantSmtpConfig.create({
    data: {
      tenantId,
      host: 'smtp.gmail.com',
      port: 587,
      username: 'orqafy.demo.notifications@gmail.com',
      passwordEnc: encryptWithKey(key, 'demo-smtp-app-password-not-real'),
      fromAddress: 'noreply@orqafy-demo.powerbyte.app',
      fromName: 'Orqafy Demo',
      useTls: true,
      isVerified: true,
    },
  });
  console.log('  ✅ TenantSmtpConfig: 1 config (Gmail SMTP, verified) — passwordEnc encrypted with APP_ENCRYPTION_KEY');
  return true;
}

// ── Settings: TenantXenditConfig ─────────────────────────────────────────────

async function seedXenditConfig(prisma: PrismaClient, tenantId: string, key: Buffer | null): Promise<boolean> {
  const existing = await prisma.tenantXenditConfig.count({ where: { tenantId } });
  if (existing > 0) {
    console.log('  ⏭  TenantXenditConfig already seeded. Skipping.');
    return true;
  }
  if (key === null) {
    console.log(
      '  ⚠️  TenantXenditConfig SKIPPED — APP_ENCRYPTION_KEY not set (or not a valid 32-byte base64 key) in the seed environment; secretKeyEnc/webhookTokenEnc are required columns so they cannot be safely seeded without it.',
    );
    return false;
  }
  await prisma.tenantXenditConfig.create({
    data: {
      tenantId,
      secretKeyEnc: encryptWithKey(key, 'xnd_development_demo-not-a-real-secret-key'),
      publicKey: 'xnd_public_development_demo-not-a-real-public-key',
      webhookTokenEnc: encryptWithKey(key, 'demo-xendit-webhook-verification-token'),
      isLive: false,
      isVerified: true,
      enabledMethods: ['card', 'gcash', 'paymaya', 'over_the_counter'],
    },
  });
  console.log('  ✅ TenantXenditConfig: 1 config (test/sandbox mode, verified) — secretKeyEnc + webhookTokenEnc encrypted with APP_ENCRYPTION_KEY');
  return true;
}

// ── Entry point ───────────────────────────────────────────────────────────

export async function seedComplianceSettings(
  prisma: PrismaClient,
  tenantId: string,
  users: Array<{ id: string }>,
): Promise<void> {
  console.log('🔐 Seeding compliance + settings surfaces...');

  await seedBreachRecords(prisma, tenantId, users);
  await seedDataSubjectRequests(prisma, tenantId, users);

  const key = getEncryptionKeyOrNull();
  const smtpSeeded = await seedSmtpConfig(prisma, tenantId, key);
  const xenditSeeded = await seedXenditConfig(prisma, tenantId, key);

  if (key === null && !smtpSeeded && !xenditSeeded) {
    console.log(
      '  ℹ️  Set APP_ENCRYPTION_KEY (base64, 32 raw bytes — matches apps/web) in the seed environment and re-run to populate SMTP + Xendit demo configs.',
    );
  }

  console.log('✅ Compliance + settings seeding complete.');
}
