"use client";
import { AttachmentsPanel } from "@/components/attachments-panel";

interface Props {
  purchaseOrderId: string;
}

export function PurchaseOrderAttachments({ purchaseOrderId }: Props) {
  return <AttachmentsPanel entityType="purchase_order" entityId={purchaseOrderId} />;
}
