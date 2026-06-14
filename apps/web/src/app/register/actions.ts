"use server";

import { redirect } from "next/navigation";
import { TRPCError } from "@trpc/server";
import { prisma } from "@orqafy/db";
import { createQueues } from "@orqafy/jobs";
import { jobConnection } from "@/server/jobs/connection";

interface RegisterInput {
  slug: string;
  name: string;
  plan: string;
  ownerEmail: string;
  ownerName: string;
  ownerPassword: string;
}

export async function registerTenant(input: RegisterInput): Promise<{ error: string }> {
  const { slug, name, plan, ownerEmail, ownerName, ownerPassword } = input;

  // Validate slug format (mirrors registrationRouter.createTenant)
  if (slug.length < 3 || slug.length > 63) {
    return { error: "Workspace ID must be between 3 and 63 characters." };
  }
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(slug)) {
    return { error: "Workspace ID must use only lowercase letters, digits, and hyphens." };
  }

  const RESERVED = new Set([
    "platform","demo","admin","api","www","mail","static","assets",
    "app","auth","login","register","signup","dashboard","billing","support",
  ]);
  if (RESERVED.has(slug)) {
    return { error: `"${slug}" is a reserved workspace ID.` };
  }
  if (ownerPassword.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  try {
    const existing = await prisma.tenant.findFirst({ where: { slug } });
    if (existing !== null) {
      return { error: "That workspace ID is already taken." };
    }

    const dbPlan = await prisma.plan.findFirst({ where: { slug: plan } });
    if (dbPlan === null) {
      return { error: `Plan "${plan}" not found.` };
    }

    const schemaName = `t_${slug.replace(/-/g, "_")}`;
    const tenant = await prisma.tenant.create({
      data: { slug, name, schemaName, status: "provisioning", planId: dbPlan.id },
    });

    const queues = createQueues(jobConnection());

    await queues.tenantProvisioning.add("provision-tenant", {
      tenantId: tenant.id,
      userId: "system",
      tenantSlug: tenant.slug,
      tenantName: tenant.name,
      schemaName: tenant.schemaName,
      plan,
      ownerEmail,
      ownerName,
      ownerPassword,
    });
  } catch (err) {
    if (err instanceof TRPCError) return { error: err.message };
    console.error("registerTenant error:", err);
    return { error: "Something went wrong. Please try again." };
  }

  // Redirect outside try/catch (redirect() throws internally in Next.js)
  redirect(`/register/success?workspace=${encodeURIComponent(slug)}`);
}
