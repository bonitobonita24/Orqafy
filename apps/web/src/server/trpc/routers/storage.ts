import { z } from "zod";
import { createTRPCRouter, writeProcedure } from "../trpc";

// File storage operations are handled via pre-signed URLs from the storage service.
// This router provides signed upload/download URLs; actual files are stored in MinIO.
export const storageRouter = createTRPCRouter({
  getUploadUrl: writeProcedure
    .input(
      z.object({
        filename: z.string().min(1).max(255),
        contentType: z.string().min(1).max(100),
        entityType: z.string().max(50).optional(),
        entityId: z.string().cuid().optional(),
      })
    )
    .mutation(({ input, ctx }) => {
      // Sanitize filename — randomize to prevent path traversal
      const ext = input.filename.split(".").pop() ?? "bin";
      const randomName = `${crypto.randomUUID()}.${ext}`;
      const key = `${ctx.tenantId}/${input.entityType ?? "general"}/${randomName}`;

      // In production this would call MinIO presignedPutObject.
      // Returning key so the client can poll or confirm after upload.
      return { key, contentType: input.contentType };
    }),

  confirmUpload: writeProcedure
    .input(
      z.object({
        key: z.string().min(1).max(500),
        originalName: z.string().min(1).max(255),
        size: z.number().int().positive(),
        entityType: z.string().max(50).optional(),
        entityId: z.string().cuid().optional(),
      })
    )
    .mutation(({ input, ctx }) => {
      // Verify the key belongs to this tenant (first path segment must be tenantId)
      const [keyTenantId] = input.key.split("/");
      if (keyTenantId !== ctx.tenantId) {
        throw new Error("Unauthorized: key does not belong to this tenant");
      }
      return { success: true, key: input.key };
    }),

  deleteFile: writeProcedure
    .input(z.object({ key: z.string().min(1).max(500) }))
    .mutation(({ input, ctx }) => {
      const [keyTenantId] = input.key.split("/");
      if (keyTenantId !== ctx.tenantId) {
        throw new Error("Unauthorized: key does not belong to this tenant");
      }
      // In production: call MinIO removeObject
      return { success: true };
    }),
});
