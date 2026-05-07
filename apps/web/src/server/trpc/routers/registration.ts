import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { prisma } from "@orqafy/db";
import { createQueues } from "@orqafy/jobs";

const RESERVED_SLUGS = new Set([
  "platform",
  "demo",
  "admin",
  "api",
  "www",
  "mail",
  "static",
  "assets",
  "app",
  "auth",
  "login",
  "register",
  "signup",
  "dashboard",
  "billing",
  "support",
]);

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

function validateSlugFormat(slug: string): { valid: boolean; error?: string } {
  if (slug.length < 3) {
    return { valid: false, error: "Slug must be at least 3 characters." };
  }
  if (slug.length > 63) {
    return { valid: false, error: "Slug must be at most 63 characters." };
  }
  if (!SLUG_REGEX.test(slug)) {
    return {
      valid: false,
      error:
        "Slug must contain only lowercase letters, digits, and hyphens, and must not start or end with a hyphen.",
    };
  }
  if (RESERVED_SLUGS.has(slug)) {
    return { valid: false, error: `"${slug}" is a reserved slug.` };
  }
  return { valid: true };
}

export const registrationRouter = createTRPCRouter({
  validateSlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const formatResult = validateSlugFormat(input.slug);
      if (!formatResult.valid) {
        return { valid: false, available: false, error: formatResult.error };
      }

      const existing = await prisma.tenant.findFirst({
        where: { slug: input.slug },
      });

      return {
        valid: true,
        available: existing === null,
        error: undefined,
      };
    }),

  createTenant: publicProcedure
    .input(
      z.object({
        slug: z.string(),
        name: z.string().min(1),
        plan: z.string().min(1),
        ownerEmail: z.string().email(),
        ownerName: z.string().min(1),
        ownerPassword: z.string().min(8),
      }),
    )
    .mutation(async ({ input }) => {
      const formatResult = validateSlugFormat(input.slug);
      if (!formatResult.valid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: formatResult.error ?? "Invalid slug.",
        });
      }

      const existingTenant = await prisma.tenant.findFirst({
        where: { slug: input.slug },
      });
      if (existingTenant !== null) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This slug is already taken.",
        });
      }

      const plan = await prisma.plan.findFirst({
        where: { slug: input.plan },
      });
      if (plan === null) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Plan "${input.plan}" not found.`,
        });
      }

      const schemaName = `t_${input.slug.replace(/-/g, "_")}`;
      const tenant = await prisma.tenant.create({
        data: {
          slug: input.slug,
          name: input.name,
          schemaName,
          status: "provisioning",
          planId: plan.id,
        },
      });

      const queues = createQueues({
        host: process.env["REDIS_HOST"] ?? "localhost",
        port: parseInt(process.env["REDIS_PORT"] ?? "6379", 10),
        password: process.env["REDIS_PASSWORD"],
      });

      await queues.tenantProvisioning.add("provision-tenant", {
        tenantId: tenant.id,
        userId: "system",
        tenantSlug: tenant.slug,
        tenantName: tenant.name,
        schemaName: tenant.schemaName,
        plan: input.plan,
        ownerEmail: input.ownerEmail,
        ownerName: input.ownerName,
        ownerPassword: input.ownerPassword,
      });

      return { tenantId: tenant.id, status: tenant.status };
    }),
});
