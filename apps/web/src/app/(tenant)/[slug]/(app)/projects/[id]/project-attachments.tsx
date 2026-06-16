"use client";
import { AttachmentsPanel } from "@/components/attachments-panel";

interface Props {
  projectId: string;
}

export function ProjectAttachments({ projectId }: Props) {
  return <AttachmentsPanel entityType="project" entityId={projectId} />;
}
