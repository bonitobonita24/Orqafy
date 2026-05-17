"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

interface ActionConfig {
  next: OrderStatus;
  label: string;
  pendingLabel: string;
  className: string;
  destructive?: boolean;
}

const ACTIONS_BY_STATUS: Record<OrderStatus, ActionConfig[]> = {
  pending: [
    {
      next: "confirmed",
      label: "Confirm",
      pendingLabel: "Confirming…",
      className:
        "border-[#00d992] bg-[#00d992]/10 text-[#00d992] hover:bg-[#00d992]/20",
    },
    {
      next: "cancelled",
      label: "Cancel",
      pendingLabel: "Cancelling…",
      className: "border-red-400 bg-red-400/10 text-red-400 hover:bg-red-400/20",
      destructive: true,
    },
  ],
  confirmed: [
    {
      next: "processing",
      label: "Start processing",
      pendingLabel: "Starting…",
      className:
        "border-sky-400 bg-sky-400/10 text-sky-400 hover:bg-sky-400/20",
    },
    {
      next: "cancelled",
      label: "Cancel",
      pendingLabel: "Cancelling…",
      className: "border-red-400 bg-red-400/10 text-red-400 hover:bg-red-400/20",
      destructive: true,
    },
  ],
  processing: [
    {
      next: "shipped",
      label: "Mark shipped",
      pendingLabel: "Shipping…",
      className:
        "border-sky-400 bg-sky-400/10 text-sky-400 hover:bg-sky-400/20",
    },
    {
      next: "cancelled",
      label: "Cancel",
      pendingLabel: "Cancelling…",
      className: "border-red-400 bg-red-400/10 text-red-400 hover:bg-red-400/20",
      destructive: true,
    },
  ],
  shipped: [
    {
      next: "delivered",
      label: "Mark delivered",
      pendingLabel: "Marking…",
      className:
        "border-[#00d992] bg-[#00d992]/10 text-[#00d992] hover:bg-[#00d992]/20",
    },
  ],
  delivered: [
    {
      next: "refunded",
      label: "Refund",
      pendingLabel: "Refunding…",
      className:
        "border-amber-400 bg-amber-400/10 text-amber-400 hover:bg-amber-400/20",
      destructive: true,
    },
  ],
  cancelled: [],
  refunded: [],
};

interface OrderStatusActionsProps {
  orderId: string;
  status: string;
}

export function OrderStatusActions({ orderId, status }: OrderStatusActionsProps) {
  const router = useRouter();
  const [pending, setPending] = useState<OrderStatus | null>(null);

  const update = trpc.storefront.updateOrderStatus.useMutation({
    onSuccess: (data) => {
      toast.success(`Order ${data.orderNumber ?? ""} → ${data.status}`);
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
    onSettled: () => setPending(null),
  });

  const actions = ACTIONS_BY_STATUS[status as OrderStatus] ?? [];
  if (actions.length === 0) {
    return null;
  }

  const isPending = pending !== null;

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <button
          key={action.next}
          type="button"
          disabled={isPending}
          onClick={() => {
            if (
              action.destructive === true &&
              !window.confirm(`Are you sure you want to ${action.label.toLowerCase()} this order?`)
            ) {
              return;
            }
            setPending(action.next);
            update.mutate({ id: orderId, status: action.next });
          }}
          className={`rounded-md border px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50 ${action.className}`}
        >
          {pending === action.next ? action.pendingLabel : action.label}
        </button>
      ))}
    </div>
  );
}
