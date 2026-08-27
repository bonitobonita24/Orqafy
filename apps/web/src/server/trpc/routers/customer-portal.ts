import { z } from "zod";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure, writeProcedure } from "../trpc";
import { matrixMiddleware } from "../middleware/matrix";
import { prisma as db, writeAuditLog } from "@orqafy/db";
import { rateLimiters } from "@/server/lib/rate-limit";

// Staff-side customer-portal management (invite/disable/reset). Gated by the
// "crm" matrix feature's "update" action (customers/clients are CRM entities
// — see client.ts's identical "crm" feature-key rationale). `writeProcedure`
// still enforces the demo-tenant mutation guard underneath the matrix check.
const portalManageProcedure = writeProcedure.use(matrixMiddleware("crm", "update"));

const INVITE_TTL_MS = 72 * 60 * 60 * 1000; // 72h
const BCRYPT_ROUNDS = 12; // matches packages/db/src/seed/index.ts

function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

function generateRawToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * Loads a Customer scoped to the caller's tenant. Deliberately generic
 * NOT_FOUND (not FORBIDDEN) on a wrong-tenant id — never confirms the id
 * exists in another tenant (matches security.md's tenant-isolation
 * enumeration-resistance posture; same shape as invoice.ts's
 * loadInvoiceForTenant).
 */
async function loadCustomerForTenant(customerId: string, tenantId: string) {
  const customer = await db.customer.findUnique({ where: { id: customerId } });
  if (!customer || customer.tenantId !== tenantId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found." });
  }
  return customer;
}

/**
 * Creates a fresh portal invite for a customer: invalidates any prior
 * unconsumed invite, generates a raw token (returned to the caller ONCE),
 * and persists only its SHA-256 hash. Shared by `invite` and
 * `resetPassword` (T1.5 spec: reset re-issues an invite).
 */
async function issueInvite(args: { customerId: string; tenantId: string; email: string; createdById: string }) {
  const { customerId, tenantId, email, createdById } = args;

  // Invalidate/replace any prior unconsumed invite for this customer so only
  // the newest token is ever valid (single-active-invite-per-customer).
  await db.customerPortalInvite.deleteMany({
    where: { customerId, tenantId, consumedAt: null },
  });

  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  const invite = await db.customerPortalInvite.create({
    data: {
      tenantId,
      customerId,
      tokenHash,
      email,
      expiresAt,
      createdById,
    },
  });

  return { invite, rawToken };
}

// TODO(portal-email): no transactional-mailer utility exists yet in this repo
// (grep found nodemailer wired only as an admin-configurable SMTP relay in
// smtp-config.ts, with no send-mail call site anywhere in apps/web/src —
// same finding as memory `SMTP Infrastructure Present but No Email Sending
// Implementation Found`, 2026-08-09). Copy-link MVP: the raw acceptUrl is
// returned to the staff caller to send manually, same posture as D-4.

export const customerPortalRouter = createTRPCRouter({
  // ── STAFF ────────────────────────────────────────────────────────────
  invite: portalManageProcedure
    .input(z.object({ customerId: z.string().cuid(), email: z.string().email().optional() }).strict())
    .mutation(async ({ input, ctx }) => {
      const customer = await loadCustomerForTenant(input.customerId, ctx.tenantId);
      const email = input.email ?? customer.portalEmail;
      if (email === null || email === undefined || email === "") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This customer has no portal email on file — supply one to invite.",
        });
      }

      const { invite, rawToken } = await issueInvite({
        customerId: customer.id,
        tenantId: ctx.tenantId,
        email,
        createdById: ctx.userId,
      });

      await writeAuditLog(db, {
        userId: ctx.userId,
        action: "CREATE",
        entity: "CustomerPortalInvite",
        entityId: invite.id,
        after: { customerId: customer.id, email },
      });

      return {
        inviteId: invite.id,
        acceptUrl: `/${ctx.tenantSlug}/portal/accept?token=${rawToken}`,
      };
    }),

  disable: portalManageProcedure
    .input(z.object({ customerId: z.string().cuid() }).strict())
    .mutation(async ({ input, ctx }) => {
      const customer = await loadCustomerForTenant(input.customerId, ctx.tenantId);

      // Security-review fix: a disable must also purge any outstanding
      // unconsumed invite in the SAME transaction as the customer update —
      // otherwise a stale invite's `setPassword` could flip portalEnabled
      // back to true, re-enabling a deliberately-disabled portal account.
      const updated = await db.$transaction(async (tx) => {
        const result = await tx.customer.update({
          where: { id: customer.id },
          data: {
            portalEnabled: false,
            customerSecurityVersion: { increment: 1 },
          },
        });
        await tx.customerPortalInvite.deleteMany({
          where: { customerId: customer.id, tenantId: ctx.tenantId, consumedAt: null },
        });
        return result;
      });

      await writeAuditLog(db, {
        userId: ctx.userId,
        action: "UPDATE",
        entity: "Customer",
        entityId: customer.id,
        before: { portalEnabled: customer.portalEnabled },
        after: { portalEnabled: false },
      });

      return { customerId: updated.id, portalEnabled: updated.portalEnabled };
    }),

  resetPassword: portalManageProcedure
    .input(z.object({ customerId: z.string().cuid() }).strict())
    .mutation(async ({ input, ctx }) => {
      const customer = await loadCustomerForTenant(input.customerId, ctx.tenantId);
      const email = customer.portalEmail;
      if (email === null || email === undefined || email === "") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This customer has no portal email on file.",
        });
      }

      // Bump the security version FIRST so any live session dies immediately,
      // independent of whether the new invite is ever accepted.
      await db.customer.update({
        where: { id: customer.id },
        data: { customerSecurityVersion: { increment: 1 } },
      });

      const { invite, rawToken } = await issueInvite({
        customerId: customer.id,
        tenantId: ctx.tenantId,
        email,
        createdById: ctx.userId,
      });

      await writeAuditLog(db, {
        userId: ctx.userId,
        action: "UPDATE",
        entity: "Customer",
        entityId: customer.id,
        after: { action: "portal_password_reset", inviteId: invite.id },
      });

      return {
        inviteId: invite.id,
        acceptUrl: `/${ctx.tenantSlug}/portal/accept?token=${rawToken}`,
      };
    }),

  // ── PUBLIC (token-authorized, no session) ───────────────────────────
  acceptInvite: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const ip = ctx.req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
      rateLimiters.auth.check(ip);

      const tokenHash = hashToken(input.token);
      const invite = await db.customerPortalInvite.findUnique({ where: { tokenHash } });

      // Generic NOT_FOUND for unknown / consumed / expired — never reveals
      // which condition failed (enumeration-resistant).
      if (!invite || invite.consumedAt !== null || invite.expiresAt < new Date()) {
        throw new TRPCError({ code: "NOT_FOUND", message: "This invite link is invalid or has expired." });
      }

      const customer = await db.customer.findUnique({
        where: { id: invite.customerId },
        select: { firstName: true, lastName: true, companyName: true },
      });
      if (!customer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "This invite link is invalid or has expired." });
      }

      return {
        email: invite.email,
        customerName: customer.companyName ?? `${customer.firstName} ${customer.lastName}`,
      };
    }),

  setPassword: publicProcedure
    .input(z.object({ token: z.string().min(1), password: z.string().min(8).max(200) }))
    .mutation(async ({ input, ctx }) => {
      const ip = ctx.req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
      rateLimiters.auth.check(ip);

      const tokenHash = hashToken(input.token);
      const invite = await db.customerPortalInvite.findUnique({ where: { tokenHash } });

      if (!invite || invite.consumedAt !== null || invite.expiresAt < new Date()) {
        throw new TRPCError({ code: "NOT_FOUND", message: "This invite link is invalid or has expired." });
      }

      // Security-review fix (defense-in-depth): re-check the Customer row
      // fresh — an invite issued before an administrative deactivation must
      // never be honored to (re-)activate the portal. `disable` already
      // purges unconsumed invites, but this closes the same hole for any
      // OTHER path that deactivates a customer without going through
      // `disable` (e.g. a general customer-deactivation action).
      const now = new Date();
      const customer = await db.customer.findUnique({
        where: { id: invite.customerId },
        select: { isActive: true },
      });
      if (!customer || !customer.isActive) {
        // Consume the invite so it can never be replayed, but never set
        // portalEnabled — same generic error as any other invalid token.
        await db.customerPortalInvite.update({
          where: { id: invite.id },
          data: { consumedAt: now },
        });
        throw new TRPCError({ code: "NOT_FOUND", message: "This invite link is invalid or has expired." });
      }

      const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

      // Single-use: consume the invite in the same transaction as the
      // password write so a race can never replay the same token twice.
      await db.$transaction(async (tx) => {
        await tx.customer.update({
          where: { id: invite.customerId },
          data: {
            portalPasswordHash: passwordHash,
            portalEnabled: true,
            portalEmail: invite.email,
            customerSecurityVersion: { increment: 1 },
          },
        });
        await tx.customerPortalInvite.update({
          where: { id: invite.id },
          data: { consumedAt: now },
        });
      });

      return { success: true as const };
    }),
});
