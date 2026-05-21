import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Xendit } from "xendit-node";
import { prisma } from "@orqafy/db";
import { createTRPCRouter } from "../trpc";
import { requireRole } from "../middleware/rbac";
import { writeProcedure } from "../trpc";
import { encrypt, decrypt } from "@/lib/crypto";

// ── Authorization helpers ─────────────────────────────────────────────────────
// Reads = Administrator OR Platform Owner (composable middleware from rbac.ts).
const adminReadProcedure = requireRole("Administrator", "Platform Owner");
// Writes = same role check + demo-tenant guard from writeProcedure.
const adminWriteProcedure = writeProcedure.use(({ ctx, next }) => {
  const ADMIN_ROLES = ["Administrator", "Platform Owner"];
  if (!ctx.roles.some((r) => ADMIN_ROLES.includes(r))) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next({ ctx });
});

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
  upsert: adminWriteProcedure.input(upsertInput).mutation(async ({ ctx, input }) => {
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
    return prisma.tenantXenditConfig.upsert({
      where: { tenantId: ctx.tenantId },
      create: { tenantId: ctx.tenantId, ...data },
      update: data,
    });
  }),

  /**
   * Verify credentials by hitting Xendit's real API: create a tiny placeholder
   * invoice then immediately expire it. On success, flips isVerified to true.
   * NOTE: This batch (21b) instantiates the SDK directly with the decrypted
   * secret. Batch 21c will refactor getXenditClient(tenantId) to share this
   * logic across the webhook + storefront paths.
   */
  testConnection: adminWriteProcedure.mutation(async ({ ctx }) => {
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
    return prisma.tenantXenditConfig.update({
      where: { tenantId: ctx.tenantId },
      data: { isVerified: true },
    });
  }),

  /**
   * Remove the config entirely. Blocked when EcommerceOrder rows still
   * reference Xendit payments (xenditPaymentId NOT NULL) to prevent orphaned
   * payment history from losing its credential audit chain.
   */
  delete: adminWriteProcedure.mutation(async ({ ctx }) => {
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
    return prisma.tenantXenditConfig.delete({
      where: { tenantId: ctx.tenantId },
    });
  }),
});
