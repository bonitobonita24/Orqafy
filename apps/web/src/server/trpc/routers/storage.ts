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
      })
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
      })
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
    .input(z.object({ attachmentId: z.string().cuid() }))
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
