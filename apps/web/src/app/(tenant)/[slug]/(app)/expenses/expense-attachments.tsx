"use client";
import { AttachmentsPanel } from "@/components/attachments-panel";

interface Props {
  expenseId: string;
  readOnly?: boolean;
}

export function ExpenseAttachments({ expenseId, readOnly }: Props) {
  return (
    <AttachmentsPanel
      entityType="expense"
      entityId={expenseId}
      {...(readOnly !== undefined ? { readOnly } : {})}
    />
  );
}
