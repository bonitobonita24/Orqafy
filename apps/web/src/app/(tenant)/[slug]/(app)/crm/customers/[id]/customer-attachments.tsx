"use client";
import { AttachmentsPanel } from "@/components/attachments-panel";

interface Props {
  customerId: string;
}

export function CustomerAttachments({ customerId }: Props) {
  return <AttachmentsPanel entityType="customer" entityId={customerId} />;
}
