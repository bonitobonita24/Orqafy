// Batch 21c (Direction F complete): per-tenant Xendit client.
// Replaces the prior process.env-based singleton with per-tenant lookup.
// Reads TenantXenditConfig.secretKeyEnc, decrypts via @/lib/crypto, and
// returns a fresh Xendit SDK instance scoped to that tenant. Throws if
// no config exists or if the config has not been verified (isVerified=false)
// so unverified credentials cannot accidentally process real payments.
//
// getXenditWebhookToken removed — webhook tokens are now per-tenant and
// resolved by the webhook handler directly from the order's tenant.
import { Xendit } from "xendit-node";
import { prisma } from "@orqafy/db";
import { decrypt } from "@/lib/crypto";

export async function getXenditClient(tenantId: string): Promise<Xendit> {
  const row = await prisma.tenantXenditConfig.findUnique({
    where: { tenantId },
  });
  if (row === null) {
    throw new Error(
      `Xendit is not configured for this tenant (tenantId=${tenantId})`,
    );
  }
  if (!row.isVerified) {
    throw new Error(
      `Xendit configuration is not verified for this tenant — run Test Connection in admin settings first (tenantId=${tenantId})`,
    );
  }
  const secretKey = decrypt(row.secretKeyEnc);
  return new Xendit({ secretKey });
}
