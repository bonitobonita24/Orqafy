"use client";
import { AttachmentsPanel } from "@/components/attachments-panel";

interface Props {
  employeeId: string;
}

export function EmployeeAttachments({ employeeId }: Props) {
  return <AttachmentsPanel entityType="employee" entityId={employeeId} />;
}
