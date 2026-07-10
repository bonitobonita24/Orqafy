import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, platformProcedure } from "../trpc";
import { prisma, reassignTenantOwner as reassignTenantOwnerHelper } from "@orqafy/db";

export const platformRouter = createTRPCRouter({
  listTenants: platformProcedure
    .input(
      z
        .object({
          status: z.string().optional(),
          search: z.string().optional(),
          limit: z.number().int().min(1).max(200).default(50),
          cursor: z.string().optional(),
        })
        .default({}),
    )
    .query(async ({ input }) => {
      const where: Record<string, unknown> = {};
      if (input.status !== undefined) where["status"] = input.status;
      if (input.search !== undefined) {
        where["OR"] = [
          { name: { contains: input.search, mode: "insensitive" } },
          { slug: { contains: input.search, mode: "insensitive" } },
        ];
      }

      const tenants = await prisma.tenant.findMany({
        where,
        take: input.limit,
        ...(input.cursor !== undefined ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          slug: true,
          name: true,
          status: true,
          createdAt: true,
        },
      });

      return {
        tenants,
        nextCursor: tenants.length === input.limit ? tenants[tenants.length - 1]?.id : undefined,
      };
    }),

  getTenant: platformProcedure
    .input(z.object({ tenantId: z.string() }))
    .query(async ({ input }) => {
      const tenant = await prisma.tenant.findFirst({
        where: { id: input.tenantId },
      });
      if (tenant === null) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found." });
      }
      return { tenant };
    }),

  suspendTenant: platformProcedure
    .input(
      z.object({
        tenantId: z.string(),
        reason: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tenant = await prisma.tenant.findFirst({
        where: { id: input.tenantId },
      });
      if (tenant === null) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found." });
      }

      await prisma.tenant.update({
        where: { id: input.tenantId },
        data: { status: "suspended" },
      });

      await prisma.tenantAuditLog.create({
        data: {
          tenantId: input.tenantId,
          action: "PLATFORM:SUSPEND_TENANT",
          userId: ctx.userId,
          entity: "Tenant",
          entityId: input.tenantId,
          after: { reason: input.reason },
        },
      });

      return { success: true };
    }),

  reactivateTenant: platformProcedure
    .input(
      z.object({
        tenantId: z.string(),
        reason: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tenant = await prisma.tenant.findFirst({
        where: { id: input.tenantId },
      });
      if (tenant === null) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found." });
      }

      await prisma.tenant.update({
        where: { id: input.tenantId },
        data: { status: "active" },
      });

      await prisma.tenantAuditLog.create({
        data: {
          tenantId: input.tenantId,
          action: "PLATFORM:REACTIVATE_TENANT",
          userId: ctx.userId,
          entity: "Tenant",
          entityId: input.tenantId,
          after: { reason: input.reason },
        },
      });

      return { success: true };
    }),

  reassignTenantOwner: platformProcedure
    .input(
      z.object({
        tenantId: z.string(),
        newOwnerUserId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await reassignTenantOwnerHelper(prisma, {
          tenantId: input.tenantId,
          newOwnerUserId: input.newOwnerUserId,
        });
      } catch (e) {
        if (e instanceof Error && e.message === "NOT_FOUND") {
          throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found." });
        }
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: e instanceof Error ? e.message : "Reassign failed.",
        });
      }

      await prisma.tenantAuditLog.create({
        data: {
          tenantId: input.tenantId,
          action: "PLATFORM:REASSIGN_TENANT_OWNER",
          userId: ctx.userId,
          entity: "User",
          entityId: input.newOwnerUserId,
          after: { newOwnerUserId: input.newOwnerUserId },
        },
      });

      return { success: true };
    }),
});
