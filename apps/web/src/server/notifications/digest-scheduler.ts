/**
 * D8 — Notification Email Digest Scheduler
 *
 * Enqueues repeatable BullMQ jobs (one per active user) onto the
 * `notification-email-digest` queue. Each job runs at the configured cadence
 * (default: daily at 07:00 UTC) and is idempotent — BullMQ deduplicates
 * repeatable jobs by jobId, so calling this for the same tenant+user twice is
 * safe (the old schedule is replaced, not duplicated).
 *
 * Called from:
 *   1. `smtp-config.testConnection` (after successful SMTP verify) — starts
 *      digest scheduling for the tenant's current active users.
 *   2. The internal `/api/internal/schedule-digests` route (cron-triggered by
 *      the Docker host's crond or Komodo scheduler, daily) — ensures new users
 *      added after initial setup get their own job slot.
 *
 * Queue / job design:
 *   - `jobId` = `email-digest:<tenantId>:<userId>` — guarantees uniqueness and
 *     allows targeted removal.
 *   - `repeat` = `{ pattern: "0 7 * * *" }` (07:00 UTC daily, configurable
 *     via DIGEST_CRON env var).
 *   - `cutoffAt` is set to the job's `timestamp` (enqueue time) so the
 *     processor only digests notifications that existed WHEN the job was
 *     scheduled — late-arriving notifications slot into the NEXT window.
 *
 * Tenant correctness: only users belonging to `tenantId` are scheduled.
 */
import { createQueues, QUEUE_NAMES } from "@orqafy/jobs";
import type { NotificationEmailDigestJobData } from "@orqafy/jobs";
import { prisma } from "@orqafy/db";
import { jobConnection } from "@/server/jobs/connection";

/** Cron pattern for the digest — override via DIGEST_CRON env var. */
function digestCronPattern(): string {
  return process.env["DIGEST_CRON"] ?? "0 7 * * *";
}

/**
 * Schedule (or reschedule) digest jobs for every active user in the given
 * tenant. Returns the number of users scheduled.
 *
 * Fails-soft on individual user scheduling errors — logs the error and
 * continues to the next user so one bad record doesn't abort the whole batch.
 */
export async function scheduleDigestsForTenant(tenantId: string): Promise<number> {
  const users = await prisma.user.findMany({
    where: { tenantId, isActive: true },
    select: { id: true, email: true, firstName: true, lastName: true, displayName: true },
  });

  if (users.length === 0) {
    return 0;
  }

  const connection = jobConnection();
  const queues = createQueues(connection);
  const digestQueue = queues.notificationEmailDigest;
  const cronPattern = digestCronPattern();
  let scheduled = 0;

  for (const user of users) {
    try {
      const jobId = `email-digest:${tenantId}:${user.id}`;
      const cutoffAt = new Date().toISOString();

      const data: NotificationEmailDigestJobData = {
        tenantId,
        userId: user.id,
        recipientEmail: user.email,
        recipientName: user.displayName ?? `${user.firstName} ${user.lastName}`,
        cutoffAt,
      };

      // BullMQ repeatable jobs: add with `repeat` options.
      // Passing `jobId` as part of opts deduplicates — same job won't be
      // created twice. The `cutoffAt` in the payload will be overwritten at
      // actual execution time by the processor (it uses `job.processedOn` /
      // current time in the processor itself — the stored value is just a
      // placeholder so the type is satisfied at enqueue time).
      await digestQueue.add(QUEUE_NAMES.NOTIFICATION_EMAIL_DIGEST, data, {
        jobId,
        repeat: { pattern: cronPattern },
        removeOnComplete: { count: 50 },
        removeOnFail: false,
      });

      scheduled++;
    } catch (err) {
      console.error(
        `[digest-scheduler] failed to schedule digest for tenant=${tenantId} user=${user.id}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  console.log(
    `[digest-scheduler] scheduled ${scheduled}/${users.length} digest jobs for tenant=${tenantId} cron="${cronPattern}"`,
  );

  return scheduled;
}

/**
 * Remove digest jobs for a specific user (e.g. when user is deactivated or
 * when SMTP config is deleted).
 */
export async function cancelDigestForUser(tenantId: string, userId: string): Promise<void> {
  const connection = jobConnection();
  const queues = createQueues(connection);
  const digestQueue = queues.notificationEmailDigest;
  const jobId = `email-digest:${tenantId}:${userId}`;

  try {
    // Remove all repeatable jobs matching this jobId pattern.
    const repeatableJobs = await digestQueue.getRepeatableJobs();
    for (const rj of repeatableJobs) {
      if (rj.id === jobId || rj.key.includes(jobId)) {
        await digestQueue.removeRepeatableByKey(rj.key);
      }
    }
    console.log(`[digest-scheduler] cancelled digest job for tenant=${tenantId} user=${userId}`);
  } catch (err) {
    console.error(
      `[digest-scheduler] failed to cancel digest for tenant=${tenantId} user=${userId}:`,
      err instanceof Error ? err.message : err,
    );
  }
}
