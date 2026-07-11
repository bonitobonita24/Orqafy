import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { prisma } from "@orqafy/db";
import { createTRPCRouter } from "../trpc";
import { requireRole } from "../middleware/rbac";
import { matrixMiddleware } from "../middleware/matrix";
import { writeProcedure } from "../trpc";
import { encrypt, decrypt } from "@/lib/crypto";
import { logger } from "@/lib/logger";
import { scheduleDigestsForTenant } from "@/server/notifications/digest-scheduler";
import type * as Nodemailer from "nodemailer";

// Admin-only: reads and writes require Tenant Super Admin, Admin, or Platform Owner.
// Role names must match the seeded role names in packages/db/src/seed/roles.ts — the
// prior list checked "Administrator", a role name that no seeded role carries, which
// silently 403'd every real admin (see department.ts / compliance.ts / dsr.ts for the
// same fix already applied to sibling routers).
//
// Task 5.1 — `get` is DELIBERATELY LEFT on this inline `requireRole` gate, NOT
// migrated to the matrix. The `settings` feature's `view` action is seeded
// broad (true for every internal role, per the Task 3.3 "view tracks
// nav-visibility" rule) — routing this masked-secrets read through
// `matrixProcedure("settings","view")` would WIDEN access from admin-only to
// every internal role. See the Task 5.1 handoff report for the full finding.
const ADMIN_ROLES = ["Tenant Super Admin", "Admin", "Platform Owner"];
const adminReadProcedure = requireRole(...ADMIN_ROLES);
// Writes — migrated to the data-driven `role_permissions` matrix (feature key
// "settings"). `writeProcedure` still enforces the demo-tenant mutation
// guard; `matrixMiddleware` resolves the (feature, action) grant on top of
// it. `upsert` and `testConnection` both map to `update` (see the identical
// rationale in admin-xendit-config.ts).
const settingsUpdateProcedure = writeProcedure.use(matrixMiddleware("settings", "update"));
const settingsDeleteProcedure = writeProcedure.use(matrixMiddleware("settings", "delete"));

const upsertInput = z
  .object({
    host: z.string().min(1).max(500),
    port: z.number().int().min(1).max(65535).default(587),
    username: z.string().min(1).max(500),
    /** Plain-text password — will be encrypted before storage, never returned. */
    password: z.string().min(1).max(1000),
    fromAddress: z.string().email().max(500),
    fromName: z.string().min(1).max(200),
    useTls: z.boolean().default(true),
  })
  .strict();

export const smtpConfigRouter = createTRPCRouter({
  /**
   * Returns the tenant's SMTP config — WITHOUT the decrypted password.
   * Exposes only safe fields + a boolean `hasPassword` flag so the UI can
   * show a masked-display affordance (same pattern as adminXenditConfig.get).
   */
  get: adminReadProcedure.query(async ({ ctx }) => {
    const row = await prisma.tenantSmtpConfig.findUnique({
      where: { tenantId: ctx.tenantId },
    });
    if (row === null) return null;
    return {
      id: row.id,
      host: row.host,
      port: row.port,
      username: row.username,
      fromAddress: row.fromAddress,
      fromName: row.fromName,
      useTls: row.useTls,
      isVerified: row.isVerified,
      hasPassword: row.passwordEnc.length > 0,
      updatedAt: row.updatedAt,
    };
  }),

  /**
   * Create-or-update the SMTP config for the current tenant.
   * Encrypts the password before storage. Always resets isVerified to false —
   * any credential change requires re-running testConnection.
   */
  upsert: settingsUpdateProcedure.input(upsertInput).mutation(async ({ ctx, input }) => {
    const passwordEnc = encrypt(input.password);
    const data = {
      host: input.host,
      port: input.port,
      username: input.username,
      passwordEnc,
      fromAddress: input.fromAddress,
      fromName: input.fromName,
      useTls: input.useTls,
      isVerified: false,
    };
    const result = await prisma.tenantSmtpConfig.upsert({
      where: { tenantId: ctx.tenantId },
      create: { tenantId: ctx.tenantId, ...data },
      update: data,
    });
    logger.info(
      { tenantId: ctx.tenantId, surface: "settings.smtp", action: "upsert" },
      "tenant smtp config upserted",
    );
    return {
      id: result.id,
      host: result.host,
      port: result.port,
      username: result.username,
      fromAddress: result.fromAddress,
      fromName: result.fromName,
      useTls: result.useTls,
      isVerified: result.isVerified,
      hasPassword: result.passwordEnc.length > 0,
      updatedAt: result.updatedAt,
    };
  }),

  /**
   * Verify the SMTP config by attempting a test send to the fromAddress.
   * Uses nodemailer — only the host-level transport is verified (EHLO+STARTTLS),
   * no email is actually delivered to an external mailbox.
   */
  testConnection: settingsUpdateProcedure.mutation(async ({ ctx }) => {
    const row = await prisma.tenantSmtpConfig.findUnique({
      where: { tenantId: ctx.tenantId },
    });
    if (!row) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No SMTP configuration to test. Save credentials first.",
      });
    }

    // Lazy import nodemailer so it doesn't bloat the main bundle.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodemailer = require("nodemailer") as typeof Nodemailer;
    const transporter = nodemailer.createTransport({
      host: row.host,
      port: row.port,
      secure: row.port === 465, // port 465 = implicit TLS; 587/25 = STARTTLS
      auth: {
        user: row.username,
        pass: decrypt(row.passwordEnc),
      },
      // TLS certificate verification is always enforced — MITM-safe.
      // If the server uses a self-signed cert, add its CA to the system
      // trust store rather than disabling verification here.
      tls: { rejectUnauthorized: true },
    });

    try {
      await transporter.verify();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown SMTP error";
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `SMTP verification failed: ${message}`,
      });
    }

    const verified = await prisma.tenantSmtpConfig.update({
      where: { tenantId: ctx.tenantId },
      data: { isVerified: true },
    });
    logger.info(
      { tenantId: ctx.tenantId, surface: "settings.smtp", action: "testConnection" },
      "tenant smtp config connection verified",
    );

    // D8 — Kick off digest scheduling for all active users in this tenant now
    // that SMTP is verified. Fail-soft: a scheduling failure must not prevent
    // the success response from reaching the admin who just verified SMTP.
    void scheduleDigestsForTenant(ctx.tenantId).catch((err: unknown) => {
      logger.error(
        { tenantId: ctx.tenantId, surface: "settings.smtp", action: "scheduleDigests" },
        `Failed to schedule digest jobs after SMTP verify: ${err instanceof Error ? err.message : String(err)}`,
      );
    });

    return {
      id: verified.id,
      isVerified: verified.isVerified,
      updatedAt: verified.updatedAt,
    };
  }),

  /**
   * Remove the SMTP config entirely.
   */
  delete: settingsDeleteProcedure.mutation(async ({ ctx }) => {
    const existing = await prisma.tenantSmtpConfig.findUnique({
      where: { tenantId: ctx.tenantId },
    });
    if (!existing) {
      throw new TRPCError({ code: "NOT_FOUND", message: "No SMTP configuration to delete." });
    }
    const deleted = await prisma.tenantSmtpConfig.delete({
      where: { tenantId: ctx.tenantId },
    });
    logger.warn(
      { tenantId: ctx.tenantId, surface: "settings.smtp", action: "delete" },
      "tenant smtp config deleted",
    );
    return deleted;
  }),
});
