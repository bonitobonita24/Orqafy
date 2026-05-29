import { TRPCError } from "@trpc/server";
import { getXenditClient } from "@/lib/xendit";
import { logger } from "@/lib/logger";

export interface CreateXenditInvoiceForOrderInput {
  // Batch 21c: tenantId required — selects which TenantXenditConfig's secret
  // signs the Xendit invoice request. Callers MUST pass ctx.tenantId.
  tenantId: string;
  orderId: string;
  orderNumber: string;
  totalAmount: number;
  customerEmail: string | null;
}

export interface XenditInvoiceResult {
  invoiceId: string | null;
  invoiceUrl: string;
}

export async function createXenditInvoiceForOrder({
  tenantId,
  orderId,
  orderNumber,
  totalAmount,
  customerEmail,
}: CreateXenditInvoiceForOrderInput): Promise<XenditInvoiceResult> {
  const xendit = await getXenditClient(tenantId);
  try {
    logger.info({ tenantId, orderId, orderNumber, totalAmount, surface: "xendit.invoice.create" }, "creating xendit invoice");
    const invoice = await xendit.Invoice.createInvoice({
      data: {
        externalId: orderId,
        amount: totalAmount,
        description: `Order ${orderNumber}`,
        currency: "PHP",
        ...(customerEmail !== null &&
          customerEmail !== "" && { payerEmail: customerEmail }),
      },
    });
    logger.info({ tenantId, orderId, invoiceId: invoice.id ?? null, surface: "xendit.invoice.create" }, "xendit invoice created");
    return {
      invoiceId: invoice.id ?? null,
      invoiceUrl: invoice.invoiceUrl,
    };
  } catch (err) {
    logger.error({ tenantId, orderId, surface: "xendit.invoice.create", err: err instanceof Error ? { name: err.name, message: err.message } : err }, "xendit invoice creation failed");
    const message = err instanceof Error ? err.message : "Xendit error";
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message,
      cause: err,
    });
  }
}
