"use client";
import { AttachmentsPanel } from "@/components/attachments-panel";

interface Props {
  invoiceId: string;
}

export function InvoiceAttachments({ invoiceId }: Props) {
  return <AttachmentsPanel entityType="invoice" entityId={invoiceId} />;
}
