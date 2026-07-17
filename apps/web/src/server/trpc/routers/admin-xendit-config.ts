import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Xendit } from "xendit-node";
import { prisma } from "@orqafy/db";
import { createTRPCRouter } from "../trpc";
import { requireRole } from "../middleware/rbac";
import { matrixMiddleware } from "../middleware/matrix";
import { writeProcedure } from "../trpc";
import { encrypt, decrypt } from "@/lib/crypto";
import { logger } from "@/lib/logger";

// ── Authorization helpers ─────────────────────────────────────────────────────
// Reads = Tenant Super Admin, Admin, OR Platform Owner (composable middleware from rbac.ts).
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
// it. `upsert` and `testConnection` both map to `update` (an idempotent
// "set the tenant's config" write, not a distinct create-vs-edit split) —
// the Task 3.3 backfill grants Admin both `create` and `update` on
// "settings" so either mapping preserves parity; `update` is used for
// clarity since this config is repeatedly re-saved in place.
const settingsUpdateProcedure = writeProcedure.use(matrixMiddleware("settings", "update"));
const settingsDeleteProcedure = writeProcedure.use(matrixMiddleware("settings", "delete"));

// ── Input schemas ─────────────────────────────────────────────────────────────
const PAYMENT_METHODS = [
  "CARD",
  "EWALLET",
  "BANK_TRANSFER",
  "RETAIL_OUTLET",
  "QR_CODE",
  "DIRECT_DEBIT",
] as const;

const upsertInput = z
  .object({
    secretKey: z.string().min(1).max(500),
    publicKey: z.string().min(1).max(500),
    webhookToken: z.string().min(1).max(500),
    isLive: z.boolean(),
    enabledMethods: z.array(z.enum(PAYMENT_METHODS)).default([]),
  })
  .strict();

export const adminXenditConfigRouter = createTRPCRouter({
  /**
   * Returns the tenant's Xendit config — WITHOUT decrypted secrets.
   * Exposes only public-safe fields + boolean "has-value" flags so the UI can
   * render a masked-display affordance without ever seeing the encrypted blob.
   */
  get: adminReadProcedure.query(async ({ ctx }) => {
    const row = await prisma.tenantXenditConfig.findUnique({
      where: { tenantId: ctx.tenantId },
    });
    if (row === null) return null;
    return {
      id: row.id,
      publicKey: row.publicKey,
      isLive: row.isLive,
      isVerified: row.isVerified,
      enabledMethods: row.enabledMethods as string[],
      hasSecretKey: row.secretKeyEnc.length > 0,
      hasWebhookToken: row.webhookTokenEnc.length > 0,
      updatedAt: row.updatedAt,
    };
  }),

  /**
   * Create-or-update the config for the current tenant.
   * Encrypts secretKey + webhookToken before storage. Always resets isVerified
   * to false — any credential change requires re-running testConnection.
   */
  upsert: settingsUpdateProcedure.input(upsertInput).mutation(async ({ ctx, input }) => {
    const secretKeyEnc = encrypt(input.secretKey);
    const webhookTokenEnc = encrypt(input.webhookToken);
    const data = {
      secretKeyEnc,
      publicKey: input.publicKey,
      webhookTokenEnc,
      isLive: input.isLive,
      enabledMethods: input.enabledMethods,
      isVerified: false,
    };
    const result = await prisma.tenantXenditConfig.upsert({
      where: { tenantId: ctx.tenantId },
      create: { tenantId: ctx.tenantId, ...data },
      update: data,
    });
    logger.info({ tenantId: ctx.tenantId, surface: "admin.xendit.config", action: "upsert" }, "tenant xendit config upserted");
    return result;
  }),

  /**
   * Verify credentials by hitting Xendit's real API: create a tiny placeholder
   * invoice then immediately expire it. On success, flips isVerified to true.
   * NOTE: This batch (21b) instantiates the SDK directly with the decrypted
   * secret. Batch 21c will refactor getXenditClient(tenantId) to share this
   * logic across the webhook + storefront paths.
   */
  testConnection: settingsUpdateProcedure.mutation(async ({ ctx }) => {
    const row = await prisma.tenantXenditConfig.findUnique({
      where: { tenantId: ctx.tenantId },
    });
    if (row === null) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No Xendit configuration to test. Save credentials first.",
      });
    }

    const secretKey = decrypt(row.secretKeyEnc);
    const xendit = new Xendit({ secretKey });
    const externalId = `test-${ctx.tenantId}-${Date.now()}`;

    // Create a placeholder invoice (smallest legal IDR amount).
    const invoice = (await xendit.Invoice.createInvoice({
      data: {
        externalId,
        amount: 10_000, // IDR 10,000 — Xendit's typical floor for test invoices
        description: "Orqafy connection-verification placeholder (auto-expired)",
        invoiceDuration: 60,
      },
    })) as { id: string };

    // Immediately expire it so no real payment can occur.
    await xendit.Invoice.expireInvoice({ invoiceId: invoice.id });

    // Mark verified.
    const verified = await prisma.tenantXenditConfig.update({
      where: { tenantId: ctx.tenantId },
      data: { isVerified: true },
    });
    logger.info({ tenantId: ctx.tenantId, surface: "admin.xendit.config", action: "testConnection" }, "tenant xendit config connection tested");
    return verified;
  }),

  /**
   * Remove the config entirely. Blocked when EcommerceOrder rows still
   * reference Xendit payments (xenditPaymentId NOT NULL) to prevent orphaned
   * payment history from losing its credential audit chain.
   */
  delete: settingsDeleteProcedure.mutation(async ({ ctx }) => {
    // Batch 21c: EcommerceOrder now carries tenantId (public-schema column).
    // The 21b comment claiming this entity is tenant-schema was incorrect —
    // before 21c there was no tenant scoping on orders at all, so this FK
    // count was actually counting across every tenant. Now scoped properly.
    const refs = await prisma.ecommerceOrder.count({
      where: {
        tenantId: ctx.tenantId,
        xenditPaymentId: { not: null },
      },
    });
    if (refs > 0) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `Cannot delete Xendit configuration — ${String(refs)} order(s) still reference Xendit payments.`,
      });
    }
    const deleted = await prisma.tenantXenditConfig.delete({
      where: { tenantId: ctx.tenantId },
    });
    logger.warn({ tenantId: ctx.tenantId, surface: "admin.xendit.config", action: "delete" }, "tenant xendit config deleted");
    return deleted;
  }),
});
