/**
 * D8 — Notification Email Digest Processor
 *
 * Consumes jobs from the `notification-email-digest` BullMQ queue.
 * Each job targets a single user within a tenant. The processor:
 *
 *   1. Loads all unsent, undigested notifications for the recipient
 *      (created before the job's `cutoffAt`, not yet in an email digest)
 *   2. Short-circuits if there is nothing to send (no rows found)
 *   3. Loads the tenant's SMTP config (stored encrypted in Postgres)
 *   4. Builds a plain-text + HTML batch email listing every notification
 *   5. Sends via nodemailer using the tenant's own SMTP credentials
 *   6. Stamps `email_digest_sent_at` on all included rows (atomic update)
 *
 * Fail-safety:
 *   - Steps 1-4 failing throws → BullMQ retries per DEFAULT_JOB_OPTIONS (3 ×
 *     exponential from 5 s).
 *   - Step 5 (SMTP send) failing throws → same retry behaviour.
 *   - Step 6 (stampings) failing logs + throws → retryable; `emailDigestSentAt`
 *     being null means the notification MAY be included in the NEXT digest
 *     (acceptable double-send risk during SMTP outage, far preferable to silent
 *     drop). The duplicate risk window is bounded to the retry back-off period.
 *
 * Tenant correctness:
 *   - All DB queries carry `tenantId` (from `job.data`) so no cross-tenant
 *     data is ever fetched.
 *   - SMTP config is looked up by `tenantId` — tenants send FROM their own
 *     mail server, never a shared Orqafy relay.
 */
import type { Job } from 'bullmq';
import nodemailer from 'nodemailer';
import { prisma } from '@orqafy/db';
import type { NotificationEmailDigestJobData } from '@orqafy/jobs';

// ── Crypto helpers ────────────────────────────────────────────────────────────
// The worker does not import from the web app layer. Encryption uses AES-256-GCM
// via Node's built-in crypto — the same algorithm as apps/web/src/lib/crypto.ts.
// Both sides must share ENCRYPTION_KEY (32-byte hex in env).
import { createDecipheriv } from 'node:crypto';

function decrypt(encryptedHex: string): string {
  const key = process.env['ENCRYPTION_KEY'];
  if (key == null || key === '') {
    throw new Error('[email-digest] ENCRYPTION_KEY env var is required for SMTP password decryption');
  }
  // Format: <iv-hex>:<authTag-hex>:<ciphertext-hex>
  const [ivHex, authTagHex, ciphertextHex] = encryptedHex.split(':');
  if (ivHex == null || ivHex === '' || authTagHex == null || authTagHex === '' || ciphertextHex == null || ciphertextHex === '') {
    throw new Error('[email-digest] Malformed encrypted value — expected iv:authTag:ciphertext');
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    Buffer.from(key, 'hex'),
    Buffer.from(ivHex, 'hex'),
  );
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface DigestNotification {
  id: string;
  category: string;
  title: string;
  body: string;
  createdAt: Date;
}

// ── HTML email template ───────────────────────────────────────────────────────
function buildEmailHtml(recipientName: string, items: DigestNotification[]): string {
  const rows = items
    .map(
      (n) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;">
          <strong style="color:#111827;font-size:14px;">${escapeHtml(n.title)}</strong><br>
          <span style="color:#6b7280;font-size:13px;">${escapeHtml(n.body)}</span><br>
          <span style="color:#9ca3af;font-size:11px;">${n.createdAt.toUTCString()} &middot; ${escapeHtml(n.category)}</span>
        </td>
      </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.1);padding:32px;">
        <tr>
          <td style="padding-bottom:24px;border-bottom:2px solid #e5e7eb;">
            <h1 style="margin:0;font-size:20px;color:#111827;">Your Notification Digest</h1>
            <p style="margin:4px 0 0;color:#6b7280;font-size:14px;">
              Hi ${escapeHtml(recipientName)}, here are your recent Orqafy notifications.
            </p>
          </td>
        </tr>
        <tr><td>
          <table width="100%" cellpadding="0" cellspacing="0">
            ${rows}
          </table>
        </td></tr>
        <tr>
          <td style="padding-top:24px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:12px;text-align:center;">
            You are receiving this digest because you have unread notifications in Orqafy.<br>
            Log in to view and manage all notifications.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildEmailText(recipientName: string, items: DigestNotification[]): string {
  const lines = items.map(
    (n) =>
      `[${n.category}] ${n.title}\n  ${n.body}\n  ${n.createdAt.toUTCString()}`,
  );
  return [
    `Hi ${recipientName},`,
    '',
    `Here are your ${items.length} recent Orqafy notification(s):`,
    '',
    ...lines,
    '',
    'Log in to Orqafy to view and manage all notifications.',
  ].join('\n');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Main processor ────────────────────────────────────────────────────────────
export async function processNotificationEmailDigest(
  job: Job<NotificationEmailDigestJobData>,
): Promise<void> {
  const { tenantId, userId, recipientEmail, recipientName, cutoffAt } = job.data;
  const cutoff = new Date(cutoffAt);

  console.log(
    `[email-digest] job=${job.id} tenant=${tenantId} user=${userId} email=${recipientEmail} cutoff=${cutoffAt}`,
  );

  // ── Step 1: Fetch unsent notifications ────────────────────────────────────
  const notifications = await prisma.notification.findMany({
    where: {
      tenantId,
      recipientUserId: userId,
      emailDigestSentAt: null, // not yet included in any digest
      createdAt: { lt: cutoff },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      category: true,
      title: true,
      body: true,
      createdAt: true,
    },
  });

  if (notifications.length === 0) {
    console.log(
      `[email-digest] job=${job.id} tenant=${tenantId} user=${userId} — no unsent notifications, skipping`,
    );
    return;
  }

  console.log(
    `[email-digest] job=${job.id} tenant=${tenantId} user=${userId} — found ${notifications.length} notification(s) to digest`,
  );

  // ── Step 2: Load tenant SMTP config ───────────────────────────────────────
  const smtpConfig = await prisma.tenantSmtpConfig.findUnique({
    where: { tenantId },
    select: {
      host: true,
      port: true,
      username: true,
      passwordEnc: true,
      fromAddress: true,
      fromName: true,
      useTls: true,
      isVerified: true,
    },
  });

  if (smtpConfig === null) {
    console.log(
      `[email-digest] job=${job.id} tenant=${tenantId} — no SMTP config, skipping digest send`,
    );
    return; // Not an error — tenant simply hasn't configured email yet
  }

  if (!smtpConfig.isVerified) {
    console.log(
      `[email-digest] job=${job.id} tenant=${tenantId} — SMTP config not verified, skipping`,
    );
    return;
  }

  // ── Step 3: Build transporter ─────────────────────────────────────────────
  const password = decrypt(smtpConfig.passwordEnc);
  const transporter = nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.port === 465,
    auth: { user: smtpConfig.username, pass: password },
    tls: { rejectUnauthorized: true },
  });

  // ── Step 4: Send digest email ─────────────────────────────────────────────
  const subject =
    notifications.length === 1
      ? `Orqafy: 1 new notification`
      : `Orqafy: ${notifications.length} new notifications`;

  await transporter.sendMail({
    from: `"${smtpConfig.fromName}" <${smtpConfig.fromAddress}>`,
    to: recipientEmail,
    subject,
    text: buildEmailText(recipientName, notifications),
    html: buildEmailHtml(recipientName, notifications),
  });

  console.log(
    `[email-digest] job=${job.id} tenant=${tenantId} user=${userId} — digest email sent (${notifications.length} notifications)`,
  );

  // ── Step 5: Stamp all included notifications ──────────────────────────────
  const notificationIds = notifications.map((n) => n.id);
  const now = new Date();

  await prisma.notification.updateMany({
    where: {
      id: { in: notificationIds },
      tenantId, // belt-and-suspenders tenant guard
      recipientUserId: userId,
    },
    data: { emailDigestSentAt: now },
  });

  console.log(
    `[email-digest] job=${job.id} tenant=${tenantId} user=${userId} — stamped ${notificationIds.length} rows emailDigestSentAt=${now.toISOString()}`,
  );
}
