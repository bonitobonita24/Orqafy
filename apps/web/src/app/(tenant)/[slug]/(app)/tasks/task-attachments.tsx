"use client";
import { AttachmentsPanel } from "@/components/attachments-panel";

interface Props {
  taskId: string;
  readOnly?: boolean;
}

export function TaskAttachments({ taskId, readOnly }: Props) {
  return (
    <AttachmentsPanel
      entityType="task"
      entityId={taskId}
      {...(readOnly !== undefined ? { readOnly } : {})}
    />
  );
}
