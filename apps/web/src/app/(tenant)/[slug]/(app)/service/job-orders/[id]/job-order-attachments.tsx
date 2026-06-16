"use client";
import { AttachmentsPanel } from "@/components/attachments-panel";

interface Props {
  jobOrderId: string;
}

export function JobOrderAttachments({ jobOrderId }: Props) {
  return <AttachmentsPanel entityType="job_order" entityId={jobOrderId} />;
}
