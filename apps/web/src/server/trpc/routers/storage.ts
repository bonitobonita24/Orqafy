import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, writeProcedure, protectedProcedure } from "../trpc";
import { prisma as db, writeAuditLog } from "@orqafy/db";
import {
  createStorageClient,
  storageConfigFromEnv,
  buildStoragePath,
  createPresignedUploadUrl,
  createPresignedDownloadUrl,
  deleteObject,
  isKeyOwnedByTenant,
  resolveBackend,
  getStorageBackend,
  MAX_FILE_SIZE,
} from "@orqafy/storage";

function getStorageBucket(): string {
  const bucket = process.env["STORAGE_BUCKET"];
  if (bucket == null || bucket === "") throw new Error("STORAGE_BUCKET is not set");
  return bucket;
}

// Lazy singleton — avoids recreating S3Client on every request
let _storageClient: ReturnType<typeof createStorageClient> | null = null;
function getStorageClient() {
  if (_storageClient === null) {
    _storageClient = createStorageClient(storageConfigFromEnv());
  }
  return _storageClient;
}

const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE.DEFAULT;

const ENTITY_TYPES = [
  "customer",
  "project",
  "job_order",
  "task",
  "expense",
  "invoice",
  "employee",
  "purchase_order",
  "goods_receipt",
] as const;

async function getStorageQuota(tenantId: string): Promise<{ usedBytes: bigint; maxBytes: bigint; planName: string }> {
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: {
      storageBytesUsed: true,
      plan: { select: { maxStorageMb: true, name: true } },
    },
  });
  if (!tenant) throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found" });
  const maxStorageMb = tenant.plan?.maxStorageMb ?? 500;
  const planName = tenant.plan?.name ?? "Free";
  return {
    usedBytes: tenant.storageBytesUsed,
    maxBytes: BigInt(maxStorageMb) * BigInt(1024 * 1024),
    planName,
  };
}

export const storageRouter = createTRPCRouter({
  /** Presign a PUT URL for direct browser upload. Enforces quota server-side. */
  getUploadUrl: writeProcedure
    .input(
      z.object({
        filename: z.string().min(1).max(255),
        contentType: z.string().min(1).max(100),
        sizeBytes: z.number().int().positive().max(MAX_FILE_SIZE_BYTES),
        entityType: z.enum(ENTITY_TYPES),
        entityId: z.string().cuid(),
      }).strict()
    )
    .mutation(async ({ input, ctx }) => {
      // Quota check
      const quota = await getStorageQuota(ctx.tenantId);
      if (quota.usedBytes + BigInt(input.sizeBytes) > quota.maxBytes) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Storage quota exceeded. Used ${(Number(quota.usedBytes) / (1024 * 1024)).toFixed(1)} MB of ${(Number(quota.maxBytes) / (1024 * 1024)).toFixed(0)} MB (${quota.planName} plan).`,
        });
      }

      const storageKey = buildStoragePath({
        tenantSlug: ctx.tenantSlug,
        entityType: input.entityType,
        entityId: input.entityId,
        originalFilename: input.filename,
      });

      const url = await createPresignedUploadUrl(getStorageClient(), {
        bucket: getStorageBucket(),
        storageKey,
        mimeType: input.contentType,
      });

      return { url, storageKey, bucket: getStorageBucket() };
    }),

  /** After browser PUT succeeds, record the Attachment row and update storageBytesUsed. */
  confirmUpload: writeProcedure
    .input(
      z.object({
        storageKey: z.string().min(1).max(500),
        filename: z.string().min(1).max(255),
        contentType: z.string().min(1).max(100),
        sizeBytes: z.number().int().positive(),
        entityType: z.enum(ENTITY_TYPES),
        entityId: z.string().cuid(),
      }).strict()
    )
    .mutation(async ({ input, ctx }) => {
      if (!isKeyOwnedByTenant(input.storageKey, ctx.tenantSlug)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Storage key does not belong to this tenant." });
      }

      const attachment = await db.$transaction(async (tx) => {
        const a = await tx.attachment.create({
          data: {
            tenantId: ctx.tenantId,
            entityType: input.entityType,
            entityId: input.entityId,
            storageKey: input.storageKey,
            filename: input.filename,
            mimeType: input.contentType,
            sizeBytes: BigInt(input.sizeBytes),
            uploadedByUserId: ctx.userId,
          },
        });
        await tx.tenant.update({
          where: { id: ctx.tenantId },
          data: { storageBytesUsed: { increment: BigInt(input.sizeBytes) } },
        });
        // Storage ledger row (backend "s3" — the presigned path always lands in
        // MinIO/S3). Lets the /api/media proxy resolve S3-backed media uniformly
        // (dual-read alongside Telegram). Idempotent on (tenantId, storageKey).
        await tx.mediaObject.upsert({
          where: {
            tenantId_storageKey: { tenantId: ctx.tenantId, storageKey: input.storageKey },
          },
          create: {
            tenantId: ctx.tenantId,
            storageKey: input.storageKey,
            entityType: input.entityType,
            backend: "s3",
            sizeBytes: input.sizeBytes,
            mimeType: input.contentType,
          },
          update: {
            sizeBytes: input.sizeBytes,
            mimeType: input.contentType,
            backend: "s3",
          },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "CREATE",
          entity: "Attachment",
          entityId: a.id,
          after: { filename: input.filename, entityType: input.entityType, entityId: input.entityId, sizeBytes: input.sizeBytes },
        });
        return a;
      });

      return { id: attachment.id, storageKey: attachment.storageKey };
    }),

  /**
   * Server-side direct upload — the Telegram-capable path (browser cannot PUT
   * directly to Telegram, so the bytes are sent through the server). Routes
   * through the STORAGE_BACKEND-selected adapter (telegram default, S3/MinIO
   * fallback), then records the Attachment + MediaObject ledger + quota in one
   * transaction. The presigned getUploadUrl/confirmUpload pair remains for the
   * S3 direct-browser-upload flow (existing consumers unchanged).
   */
  uploadDirect: writeProcedure
    .input(
      z.object({
        filename: z.string().min(1).max(255),
        contentType: z.string().min(1).max(100),
        entityType: z.enum(ENTITY_TYPES),
        entityId: z.string().cuid(),
        /** File bytes, base64-encoded (tRPC transport is JSON). */
        bodyBase64: z.string().min(1).max(72_000_000),
      }).strict()
    )
    .mutation(async ({ input, ctx }) => {
      const body = Buffer.from(input.bodyBase64, "base64");
      if (body.byteLength <= 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Empty file body." });
      }

      // Quota check (same as getUploadUrl).
      const quota = await getStorageQuota(ctx.tenantId);
      if (quota.usedBytes + BigInt(body.byteLength) > quota.maxBytes) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Storage quota exceeded. Used ${(Number(quota.usedBytes) / (1024 * 1024)).toFixed(1)} MB of ${(Number(quota.maxBytes) / (1024 * 1024)).toFixed(0)} MB (${quota.planName} plan).`,
        });
      }

      // Resolve the Telegram channel for this tenant (null => default channel).
      let chatId: string | undefined;
      if (getStorageBackend() === "telegram") {
        const tenant = await db.tenant.findUnique({
          where: { id: ctx.tenantId },
          select: { telegramChannelId: true },
        });
        chatId =
          tenant?.telegramChannelId ??
          process.env["TELEGRAM_DEFAULT_CHANNEL_ID"] ??
          "";
      }

      // Upload OUTSIDE the DB transaction (external network I/O: Telegram/S3).
      let result;
      try {
        result = await resolveBackend().upload({
          tenantId: ctx.tenantId,
          tenantSlug: ctx.tenantSlug,
          entityType: input.entityType,
          entityId: input.entityId,
          originalFilename: input.filename,
          mimeType: input.contentType,
          body,
          bucket: getStorageBucket(),
          ...(chatId !== undefined ? { chatId } : {}),
        });
      } catch (err) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: err instanceof Error ? err.message : "Upload failed.",
        });
      }

      const attachment = await db.$transaction(async (tx) => {
        const a = await tx.attachment.create({
          data: {
            tenantId: ctx.tenantId,
            entityType: input.entityType,
            entityId: input.entityId,
            storageKey: result.storageKey,
            filename: input.filename,
            mimeType: input.contentType,
            sizeBytes: BigInt(result.sizeBytes),
            uploadedByUserId: ctx.userId,
          },
        });
        await tx.tenant.update({
          where: { id: ctx.tenantId },
          data: { storageBytesUsed: { increment: BigInt(result.sizeBytes) } },
        });
        await tx.mediaObject.upsert({
          where: {
            tenantId_storageKey: { tenantId: ctx.tenantId, storageKey: result.storageKey },
          },
          create: {
            tenantId: ctx.tenantId,
            storageKey: result.storageKey,
            entityType: input.entityType,
            backend: result.backend,
            telegramChatId: result.telegramChatId ?? null,
            telegramFileId: result.telegramFileId ?? null,
            telegramMessageId:
              result.telegramMessageId !== undefined
                ? BigInt(result.telegramMessageId)
                : null,
            sizeBytes: result.sizeBytes,
            mimeType: result.mimeType,
          },
          update: {
            backend: result.backend,
            telegramChatId: result.telegramChatId ?? null,
            telegramFileId: result.telegramFileId ?? null,
            telegramMessageId:
              result.telegramMessageId !== undefined
                ? BigInt(result.telegramMessageId)
                : null,
            sizeBytes: result.sizeBytes,
            mimeType: result.mimeType,
          },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "CREATE",
          entity: "Attachment",
          entityId: a.id,
          after: {
            filename: input.filename,
            entityType: input.entityType,
            entityId: input.entityId,
            sizeBytes: result.sizeBytes,
            backend: result.backend,
          },
        });
        return a;
      });

      return {
        id: attachment.id,
        storageKey: attachment.storageKey,
        backend: result.backend,
      };
    }),

  /** List attachments for a specific entity. */
  list: protectedProcedure
    .input(z.object({
      entityType: z.enum(ENTITY_TYPES),
      entityId: z.string().cuid(),
    }))
    .query(async ({ input, ctx }) => {
      return db.attachment.findMany({
        where: { tenantId: ctx.tenantId, entityType: input.entityType, entityId: input.entityId },
        orderBy: { createdAt: "asc" },
        include: { uploadedBy: { select: { firstName: true, lastName: true, displayName: true } } },
      });
    }),

  /** Presign a GET URL for authenticated download. */
  getDownloadUrl: protectedProcedure
    .input(z.object({ attachmentId: z.string().cuid() }))
    .query(async ({ input, ctx }) => {
      const attachment = await db.attachment.findFirst({
        where: { id: input.attachmentId, tenantId: ctx.tenantId },
      });
      if (!attachment) throw new TRPCError({ code: "NOT_FOUND" });

      const url = await createPresignedDownloadUrl(getStorageClient(), {
        bucket: getStorageBucket(),
        storageKey: attachment.storageKey,
        tenantSlug: ctx.tenantSlug,
      });
      if (url === null) throw new TRPCError({ code: "FORBIDDEN" });
      return { url };
    }),

  /** Delete an attachment and reclaim storage quota. */
  delete: writeProcedure
    .input(z.object({ attachmentId: z.string().cuid() }).strict())
    .mutation(async ({ input, ctx }) => {
      const attachment = await db.attachment.findFirst({
        where: { id: input.attachmentId, tenantId: ctx.tenantId },
      });
      if (!attachment) throw new TRPCError({ code: "NOT_FOUND" });

      // Delete from object storage (best-effort)
      try {
        await deleteObject(getStorageClient(), {
          bucket: getStorageBucket(),
          storageKey: attachment.storageKey,
          tenantSlug: ctx.tenantSlug,
        });
      } catch {
        // Log but don't throw — DB record deletion is more important
      }

      await db.$transaction(async (tx) => {
        await tx.attachment.delete({ where: { id: input.attachmentId } });
        await tx.tenant.update({
          where: { id: ctx.tenantId },
          data: { storageBytesUsed: { decrement: attachment.sizeBytes } },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "DELETE",
          entity: "Attachment",
          entityId: input.attachmentId,
          before: { filename: attachment.filename, sizeBytes: Number(attachment.sizeBytes) },
        });
      });

      return { success: true };
    }),

  /** Storage quota info for the current tenant. */
  quotaInfo: protectedProcedure.query(async ({ ctx }) => {
    const quota = await getStorageQuota(ctx.tenantId);
    return {
      usedBytes: Number(quota.usedBytes),
      maxBytes: Number(quota.maxBytes),
      planName: quota.planName,
      usedMb: Number(quota.usedBytes) / (1024 * 1024),
      maxMb: Number(quota.maxBytes) / (1024 * 1024),
      percentUsed: Number(quota.maxBytes) > 0 ? (Number(quota.usedBytes) / Number(quota.maxBytes)) * 100 : 0,
    };
  }),
});
