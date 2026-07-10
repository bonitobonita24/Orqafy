/**
 * D8 — Internal: schedule / refresh notification email digest jobs.
 *
 * Called by the Docker-host cron (or Komodo scheduler) once per day to ensure
 * every active user in every tenant that has a verified SMTP config has a
 * repeatable BullMQ digest job registered.  New users added since the last
 * SMTP-verify call will pick up a slot here.
 *
 * Security model:
 *   - NOT exposed publicly.  The route requires the `INTERNAL_CRON_SECRET`
 *     header to match the env var of the same name.
 *   - The web container is not internet-accessible on this path — Traefik
 *     only forwards `/(tenant)/` and `/api/(public)` routes externally.
 *   - Still validates the secret so that accidental mis-configuration (e.g. a
 *     future Traefik rule change) does not silently expose the endpoint.
 *
 * Cron setup example (docker-compose labels / Komodo task):
 *   0 6 * * * curl -s -X POST http://orqafy_web:3000/api/internal/schedule-digests \
 *     -H "x-internal-secret: $INTERNAL_CRON_SECRET"
 */
import { timingSafeEqual } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@orqafy/db";
import { scheduleDigestsForTenant } from "@/server/notifications/digest-scheduler";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Constant-time secret comparison (avoids timing side-channels). */
function secretsMatch(provided: string | null, expected: string): boolean {
  if (provided === null) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── Auth guard ────────────────────────────────────────────────────────────
  const secret = process.env["INTERNAL_CRON_SECRET"];
  if (secret == null || secret.length < 16) {
    // Env not configured — refuse to run to avoid accidental open exposure.
    return NextResponse.json({ error: "INTERNAL_CRON_SECRET not configured" }, { status: 503 });
  }

  const provided = req.headers.get("x-internal-secret");
  if (!secretsMatch(provided, secret)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── Schedule digests for all tenants with verified SMTP ──────────────────
  const tenants = await prisma.tenantSmtpConfig.findMany({
    where: { isVerified: true },
    select: { tenantId: true },
  });

  const results: Array<{ tenantId: string; scheduled: number; error?: string }> = [];

  for (const { tenantId } of tenants) {
    try {
      const scheduled = await scheduleDigestsForTenant(tenantId);
      results.push({ tenantId, scheduled });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(
        { tenantId, surface: "internal.schedule-digests" },
        `Failed to schedule digests: ${message}`,
      );
      results.push({ tenantId, scheduled: 0, error: message });
    }
  }

  const total = results.reduce((s, r) => s + r.scheduled, 0);
  logger.info(
    { surface: "internal.schedule-digests", tenants: tenants.length, totalScheduled: total },
    "digest scheduling sweep complete",
  );

  return NextResponse.json({ ok: true, tenants: tenants.length, totalScheduled: total, results });
}
