"use client";

import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface PayWithXenditProps {
  orderId: string;
  paymentStatus: string;
  xenditPaymentId: string | null;
}

export function PayWithXendit({
  orderId,
  paymentStatus,
  xenditPaymentId,
}: PayWithXenditProps) {
  const create = trpc.storefront.createXenditInvoice.useMutation({
    onSuccess: (res) => {
      if (res.invoiceUrl !== "") {
        window.location.href = res.invoiceUrl;
      } else {
        toast.error("Xendit returned an empty invoice URL");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  if (paymentStatus !== "pending") return null;
  if (xenditPaymentId !== null) return null;

  return (
    <button
      type="button"
      onClick={() => create.mutate({ orderId })}
      disabled={create.isPending}
      className="mt-3 inline-flex items-center justify-center rounded-md border border-[#00d992] bg-[#00d992]/10 px-3 py-1.5 text-xs font-medium text-[#00d992] hover:bg-[#00d992]/20 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {create.isPending ? "Creating invoice…" : "Pay with Xendit"}
    </button>
  );
}
