/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
/**
 * D8 — notification-email-digest processor unit tests.
 *
 * All external I/O is mocked:
 *   - @orqafy/db       → prisma.notification.findMany / updateMany
 *                        prisma.tenantSmtpConfig.findUnique
 *   - nodemailer       → createTransport → sendMail
 *   - node:crypto      → createDecipheriv (returns fixed plaintext)
 *
 * Proves:
 *  1. Returns early (no email, no stamp) when there are no unsent notifications
 *  2. Returns early when no SMTP config exists for the tenant
 *  3. Returns early when SMTP config is not verified
 *  4. Sends email and stamps rows when conditions are met
 *  5. All Prisma queries carry tenantId + recipientUserId (tenant guard)
 *  6. Stamping uses the same set of notification IDs that were sent
 *  7. Subject line is singular when exactly 1 notification
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
const {
  mockFindMany,
  mockFindUnique,
  mockUpdateMany,
  mockSendMail,
  mockVerify,
  mockCreateTransport,
} = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockFindUnique: vi.fn(),
  mockUpdateMany: vi.fn(),
  mockSendMail: vi.fn(),
  mockVerify: vi.fn(),
  mockCreateTransport: vi.fn(),
}));

vi.mock('@orqafy/db', () => ({
  prisma: {
    notification: { findMany: mockFindMany, updateMany: mockUpdateMany },
    tenantSmtpConfig: { findUnique: mockFindUnique },
  },
}));

vi.mock('nodemailer', () => ({
  default: { createTransport: mockCreateTransport },
}));

// Stub crypto decryption — the exact output doesn't matter for these tests
vi.mock('node:crypto', () => ({
  createDecipheriv: vi.fn(() => ({
    setAuthTag: vi.fn(),
    update: vi.fn(() => Buffer.from('decrypted-password')),
    final: vi.fn(() => Buffer.from('')),
  })),
}));

import { processNotificationEmailDigest } from '../processors/notification-email-digest.js';
import type { NotificationEmailDigestJobData } from '@orqafy/jobs';
import type { Job } from 'bullmq';

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeJob(data: NotificationEmailDigestJobData): Job<NotificationEmailDigestJobData, any, string> {
  return {
    id: 'digest-job-1',
    data,
    attemptsMade: 0,
    processedOn: Date.now(),
  } as unknown as Job<NotificationEmailDigestJobData, any, string>;
}

const BASE_DATA: NotificationEmailDigestJobData = {
  tenantId: 'tenant-A',
  userId: 'user-1',
  recipientEmail: 'alice@example.com',
  recipientName: 'Alice Smith',
  cutoffAt: new Date('2024-06-16T07:00:00.000Z').toISOString(),
};

const SMTP_CONFIG = {
  host: 'smtp.example.com',
  port: 587,
  username: 'user@example.com',
  passwordEnc: 'iv:tag:cipher',
  fromAddress: 'noreply@example.com',
  fromName: 'Orqafy',
  useTls: true,
  isVerified: true,
};

function makeNotification(id: string) {
  return {
    id,
    category: 'task_assigned',
    title: `Task ${id}`,
    body: `Body for ${id}`,
    createdAt: new Date('2024-06-15T10:00:00.000Z'),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('processNotificationEmailDigest (D8)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default transporter mock
    mockCreateTransport.mockReturnValue({
      sendMail: mockSendMail,
      verify: mockVerify,
    });
    mockSendMail.mockResolvedValue({ messageId: 'msg-1' });
    mockUpdateMany.mockResolvedValue({ count: 2 });
    // Set a valid ENCRYPTION_KEY so decrypt() doesn't throw
    process.env['ENCRYPTION_KEY'] = 'a'.repeat(64); // 32-byte hex
  });

  it('returns early without sending when there are no unsent notifications', async () => {
    mockFindMany.mockResolvedValueOnce([]);

    await processNotificationEmailDigest(makeJob(BASE_DATA));

    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockCreateTransport).not.toHaveBeenCalled();
    expect(mockSendMail).not.toHaveBeenCalled();
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it('returns early without sending when no SMTP config exists', async () => {
    mockFindMany.mockResolvedValueOnce([makeNotification('n-1')]);
    mockFindUnique.mockResolvedValueOnce(null);

    await processNotificationEmailDigest(makeJob(BASE_DATA));

    expect(mockCreateTransport).not.toHaveBeenCalled();
    expect(mockSendMail).not.toHaveBeenCalled();
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it('returns early without sending when SMTP config is not verified', async () => {
    mockFindMany.mockResolvedValueOnce([makeNotification('n-1')]);
    mockFindUnique.mockResolvedValueOnce({ ...SMTP_CONFIG, isVerified: false });

    await processNotificationEmailDigest(makeJob(BASE_DATA));

    expect(mockCreateTransport).not.toHaveBeenCalled();
    expect(mockSendMail).not.toHaveBeenCalled();
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it('sends a digest email and stamps all included notification rows', async () => {
    const notifs = [makeNotification('n-1'), makeNotification('n-2')];
    mockFindMany.mockResolvedValueOnce(notifs);
    mockFindUnique.mockResolvedValueOnce(SMTP_CONFIG);

    await processNotificationEmailDigest(makeJob(BASE_DATA));

    // Email sent once
    expect(mockSendMail).toHaveBeenCalledOnce();
    const mailCall = mockSendMail.mock.calls[0]![0];
    expect(mailCall.to).toBe('alice@example.com');
    expect(typeof mailCall.html).toBe('string');
    expect(typeof mailCall.text).toBe('string');

    // Rows stamped with exact IDs and tenant/recipient guard
    expect(mockUpdateMany).toHaveBeenCalledOnce();
    const updateCall = mockUpdateMany.mock.calls[0]![0];
    expect(updateCall.where.id.in).toEqual(['n-1', 'n-2']);
    expect(updateCall.where.tenantId).toBe('tenant-A');
    expect(updateCall.where.recipientUserId).toBe('user-1');
    expect(updateCall.data.emailDigestSentAt).toBeInstanceOf(Date);
  });

  it('uses singular subject when exactly 1 notification', async () => {
    mockFindMany.mockResolvedValueOnce([makeNotification('n-1')]);
    mockFindUnique.mockResolvedValueOnce(SMTP_CONFIG);

    await processNotificationEmailDigest(makeJob(BASE_DATA));

    const mailCall = mockSendMail.mock.calls[0]![0];
    expect(mailCall.subject).toBe('Orqafy: 1 new notification');
  });

  it('uses plural subject for 2+ notifications', async () => {
    mockFindMany.mockResolvedValueOnce([makeNotification('n-1'), makeNotification('n-2'), makeNotification('n-3')]);
    mockFindUnique.mockResolvedValueOnce(SMTP_CONFIG);

    await processNotificationEmailDigest(makeJob(BASE_DATA));

    const mailCall = mockSendMail.mock.calls[0]![0];
    expect(mailCall.subject).toBe('Orqafy: 3 new notifications');
  });

  it('findMany query scopes to tenantId + recipientUserId + null emailDigestSentAt', async () => {
    mockFindMany.mockResolvedValueOnce([makeNotification('n-1')]);
    mockFindUnique.mockResolvedValueOnce(SMTP_CONFIG);

    await processNotificationEmailDigest(makeJob(BASE_DATA));

    const where = mockFindMany.mock.calls[0]![0].where;
    expect(where.tenantId).toBe('tenant-A');
    expect(where.recipientUserId).toBe('user-1');
    expect(where.emailDigestSentAt).toBeNull();
    expect(where.createdAt).toMatchObject({ lt: expect.any(Date) });
  });

  it('SMTP config query scopes to tenantId only', async () => {
    mockFindMany.mockResolvedValueOnce([makeNotification('n-1')]);
    mockFindUnique.mockResolvedValueOnce(SMTP_CONFIG);

    await processNotificationEmailDigest(makeJob(BASE_DATA));

    const where = mockFindUnique.mock.calls[0]![0].where;
    expect(where.tenantId).toBe('tenant-A');
  });
});
