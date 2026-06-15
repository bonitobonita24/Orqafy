"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface FulfillmentFormProps {
  orderId: string;
  initialTrackingNumber: string | null;
  initialPaymentMethod: string | null;
}

export function FulfillmentForm({
  orderId,
  initialTrackingNumber,
  initialPaymentMethod,
}: FulfillmentFormProps) {
  const router = useRouter();
  const [trackingNumber, setTrackingNumber] = useState<string>(
    initialTrackingNumber ?? "",
  );
  const [paymentMethod, setPaymentMethod] = useState<string>(
    initialPaymentMethod ?? "",
  );

  const update = trpc.storefront.updateFulfillment.useMutation({
    onSuccess: () => {
      toast.success("Fulfillment updated");
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  const trackingDirty = trackingNumber.trim() !== (initialTrackingNumber ?? "");
  const paymentDirty = paymentMethod.trim() !== (initialPaymentMethod ?? "");
  const dirty = trackingDirty || paymentDirty;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!dirty) return;
    const payload: {
      id: string;
      trackingNumber?: string;
      paymentMethod?: string;
    } = { id: orderId };
    if (trackingDirty) {
      const v = trackingNumber.trim();
      if (v.length > 0) payload.trackingNumber = v;
    }
    if (paymentDirty) {
      const v = paymentMethod.trim();
      if (v.length > 0) payload.paymentMethod = v;
    }
    if (
      payload.trackingNumber === undefined &&
      payload.paymentMethod === undefined
    ) {
      toast.info("Nothing to update");
      return;
    }
    update.mutate(payload);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-border bg-card p-4"
    >
      <h2 className="text-sm font-medium">Fulfillment</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Update shipping tracking and payment method captured for this order.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">
            Tracking number
          </span>
          <input
            type="text"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            placeholder="e.g. LBC-123456789"
            maxLength={200}
            className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">
            Payment method
          </span>
          <input
            type="text"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            placeholder="e.g. bank_transfer, gcash, credit_card"
            maxLength={100}
            className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </label>
      </div>
      <div className="mt-4 flex justify-end">
        <button
          type="submit"
          disabled={!dirty || update.isPending}
          className="rounded-md border border-primary bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {update.isPending ? "Saving…" : "Save fulfillment"}
        </button>
      </div>
    </form>
  );
}
