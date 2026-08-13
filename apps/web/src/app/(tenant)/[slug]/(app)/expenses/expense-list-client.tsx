"use client";

import { useState } from "react";
import { Paperclip } from "@/components/ui/icons";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ExpenseAttachments } from "./expense-attachments";

interface ExpenseRow {
  id: string;
  expenseNumber: string;
  description: string;
  amount: unknown;
  currency: string;
  date: Date;
  status: string;
  expenseCategory: { name: string; code: string };
  createdBy: { firstName: string; lastName: string };
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  reimbursed: "Reimbursed",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  approved: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  rejected: "text-red-400 bg-red-400/10 border-red-400/30",
  reimbursed: "text-primary bg-primary/10 border-primary/30",
};

function formatCurrency(amount: unknown, currency: string): string {
  const num =
    typeof amount === "object" && amount !== null && "toNumber" in amount
      ? (amount as { toNumber: () => number }).toNumber()
      : Number(amount);
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(num);
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

interface Props {
  expenses: ExpenseRow[];
}

export function ExpenseListClient({ expenses }: Props) {
  const [attachmentExpenseId, setAttachmentExpenseId] = useState<string | null>(null);

  if (expenses.length === 0) {
    return (
      <div className="px-6 py-12 text-center text-sm text-muted-foreground">
        No expenses recorded yet.
      </div>
    );
  }

  return (
    <>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="px-4 py-3 font-medium">Expense #</th>
            <th className="px-4 py-3 font-medium">Description</th>
            <th className="px-4 py-3 font-medium">Category</th>
            <th className="px-4 py-3 font-medium">Submitted by</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium text-right">Amount</th>
            <th className="px-4 py-3 font-medium">Date</th>
            <th className="px-4 py-3 font-medium sr-only">Files</th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((e) => {
            const statusClass =
              STATUS_COLORS[e.status] ??
              "text-muted-foreground bg-muted border-border";
            const statusLabel = STATUS_LABELS[e.status] ?? e.status;
            return (
              <tr
                key={e.id}
                className="border-b border-border last:border-0 transition-colors hover:bg-muted/30"
              >
                <td className="px-4 py-3 font-mono text-xs">{e.expenseNumber}</td>
                <td className="px-4 py-3">
                  <div className="font-medium">{e.description}</div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {e.expenseCategory.name}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {e.createdBy.firstName} {e.createdBy.lastName}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass}`}
                  >
                    {statusLabel}
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatCurrency(e.amount, e.currency)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatDate(e.date)}
                </td>
                <td className="px-4 py-3">
                  <button
                    className="rounded p-1 text-muted-foreground transition-colors hover:text-primary"
                    aria-label="Attachments"
                    onClick={() => { setAttachmentExpenseId(e.id); }}
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <Dialog
        open={attachmentExpenseId !== null}
        onOpenChange={(open) => { if (!open) setAttachmentExpenseId(null); }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Expense Attachments</DialogTitle>
          </DialogHeader>
          {attachmentExpenseId !== null && (
            <ExpenseAttachments expenseId={attachmentExpenseId} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
