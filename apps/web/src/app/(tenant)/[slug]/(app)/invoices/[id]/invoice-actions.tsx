"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PAYMENT_METHODS = [
  "cash",
  "bank_transfer",
  "gcash",
  "maya",
  "card",
  "xendit",
  "credit",
] as const;
type PaymentMethod = (typeof PAYMENT_METHODS)[number];

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  gcash: "GCash",
  maya: "Maya",
  card: "Card",
  xendit: "Xendit",
  credit: "Credit",
};

interface FundSource {
  id: string;
  name: string;
}

interface InvoiceActionsProps {
  invoiceId: string;
  status: string;
  outstandingBalance: number;
  fundSources: FundSource[];
}

export function InvoiceActions({
  invoiceId,
  status,
  outstandingBalance,
  fundSources,
}: InvoiceActionsProps) {
  const router = useRouter();

  // --- Mark Sent ---
  const [markSentOpen, setMarkSentOpen] = useState(false);

  // --- Record Payment ---
  const [recordOpen, setRecordOpen] = useState(false);
  const [payAmount, setPayAmount] = useState<string>("");
  const [payMethod, setPayMethod] = useState<PaymentMethod>("cash");
  const [payFundSourceId, setPayFundSourceId] = useState<string>("");
  const [payReference, setPayReference] = useState<string>("");
  const [payNotes, setPayNotes] = useState<string>("");
  const [payError, setPayError] = useState<string | null>(null);

  // --- Mark Paid ---
  const [markPaidOpen, setMarkPaidOpen] = useState(false);

  // --- Void ---
  const [voidOpen, setVoidOpen] = useState(false);

  // --- Mutations ---
  const markSent = trpc.invoice.markSent.useMutation({
    onSuccess: () => {
      toast.success("Invoice marked as sent.");
      router.refresh();
      setMarkSentOpen(false);
    },
    onError: (err) => {
      toast.error(err.message);
      setMarkSentOpen(false);
    },
  });

  const recordPayment = trpc.invoice.recordPayment.useMutation({
    onSuccess: () => {
      toast.success("Payment recorded.");
      router.refresh();
      resetRecordForm();
      setRecordOpen(false);
    },
    onError: (err) => {
      setPayError(err.message);
      toast.error(err.message);
    },
  });

  const markPaid = trpc.invoice.markPaid.useMutation({
    onSuccess: () => {
      toast.success("Invoice marked as paid.");
      router.refresh();
      setMarkPaidOpen(false);
    },
    onError: (err) => {
      toast.error(err.message);
      setMarkPaidOpen(false);
    },
  });

  const voidInvoice = trpc.invoice.void.useMutation({
    onSuccess: () => {
      toast.success("Invoice voided.");
      router.refresh();
      setVoidOpen(false);
    },
    onError: (err) => {
      toast.error(err.message);
      setVoidOpen(false);
    },
  });

  function resetRecordForm() {
    setPayAmount("");
    setPayMethod("cash");
    setPayFundSourceId("");
    setPayReference("");
    setPayNotes("");
    setPayError(null);
  }

  function handleRecordSubmit() {
    setPayError(null);
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) {
      setPayError("Amount must be a positive number.");
      return;
    }
    if (amount > outstandingBalance + 0.001) {
      setPayError(
        `Amount exceeds outstanding balance of ${outstandingBalance.toFixed(2)}.`,
      );
      return;
    }
    recordPayment.mutate({
      id: invoiceId,
      amount,
      method: payMethod,
      ...(payFundSourceId !== "" ? { fundSourceId: payFundSourceId } : {}),
      ...(payReference.trim() !== "" ? { referenceNumber: payReference.trim() } : {}),
      ...(payNotes.trim() !== "" ? { notes: payNotes.trim() } : {}),
    });
  }

  const canMarkSent = status === "draft";
  const canRecord = status === "sent" || status === "partially_paid";
  const canMarkPaid = status === "sent" || status === "partially_paid";
  const canVoid =
    status === "draft" || status === "sent" || status === "partially_paid";

  if (!canMarkSent && !canRecord && !canMarkPaid && !canVoid) {
    return null;
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* Mark Sent */}
      {canMarkSent && (
        <Dialog open={markSentOpen} onOpenChange={setMarkSentOpen}>
          <DialogTrigger asChild>
            <button
              type="button"
              className="rounded border border-blue-400/40 bg-blue-400/10 px-2 py-0.5 text-xs font-medium text-blue-400 hover:bg-blue-400/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Mark Sent
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Mark as Sent</DialogTitle>
              <DialogDescription>
                This will move the invoice from Draft to Sent status.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMarkSentOpen(false)}
                disabled={markSent.isPending}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => markSent.mutate({ id: invoiceId })}
                disabled={markSent.isPending}
                className="bg-blue-500 text-white hover:bg-blue-600"
              >
                {markSent.isPending ? "Marking…" : "Confirm"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Record Payment */}
      {canRecord && (
        <Dialog
          open={recordOpen}
          onOpenChange={(next) => {
            setRecordOpen(next);
            if (!next) resetRecordForm();
          }}
        >
          <DialogTrigger asChild>
            <button
              type="button"
              className="rounded border border-[#00d992]/40 bg-[#00d992]/10 px-2 py-0.5 text-xs font-medium text-[#00d992] hover:bg-[#00d992]/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Record Payment
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Record Payment</DialogTitle>
              <DialogDescription>
                Outstanding:{" "}
                <span className="text-yellow-400 font-medium">
                  {outstandingBalance.toFixed(2)}
                </span>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Amount */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  Amount <span className="text-red-400">*</span>
                </Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={outstandingBalance}
                  value={payAmount}
                  onChange={(e) => {
                    setPayAmount(e.target.value);
                    setPayError(null);
                  }}
                  placeholder={`Max ${outstandingBalance.toFixed(2)}`}
                />
              </div>

              {/* Method */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  Payment Method <span className="text-red-400">*</span>
                </Label>
                <Select
                  value={payMethod}
                  onValueChange={(v) => setPayMethod(v as PaymentMethod)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {METHOD_LABELS[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Fund Source (optional) */}
              {fundSources.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Fund Source{" "}
                    <span className="text-muted-foreground/60 font-normal">
                      (optional — auto-posts banking income)
                    </span>
                  </Label>
                  <Select
                    value={payFundSourceId}
                    onValueChange={setPayFundSourceId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select fund source…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {fundSources.map((fs) => (
                        <SelectItem key={fs.id} value={fs.id}>
                          {fs.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Reference Number (optional) */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  Reference Number{" "}
                  <span className="text-muted-foreground/60 font-normal">
                    (optional)
                  </span>
                </Label>
                <Input
                  type="text"
                  value={payReference}
                  onChange={(e) => setPayReference(e.target.value)}
                  placeholder="e.g. cheque #, transaction ID…"
                  maxLength={255}
                />
              </div>

              {/* Notes (optional) */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  Notes{" "}
                  <span className="text-muted-foreground/60 font-normal">
                    (optional)
                  </span>
                </Label>
                <Textarea
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="Any additional notes…"
                  rows={2}
                  className="resize-none"
                  maxLength={1000}
                />
              </div>

              {payError !== null && (
                <p className="text-xs text-red-400">{payError}</p>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  resetRecordForm();
                  setRecordOpen(false);
                }}
                disabled={recordPayment.isPending}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleRecordSubmit}
                disabled={recordPayment.isPending}
                className="bg-[#00d992] text-gray-950 hover:bg-[#00d992]/90"
              >
                {recordPayment.isPending ? "Recording…" : "Record Payment"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Mark Paid */}
      {canMarkPaid && (
        <Dialog open={markPaidOpen} onOpenChange={setMarkPaidOpen}>
          <DialogTrigger asChild>
            <button
              type="button"
              className="rounded border border-[#00d992]/40 bg-[#00d992]/10 px-2 py-0.5 text-xs font-medium text-[#00d992] hover:bg-[#00d992]/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Mark Paid
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Mark as Paid</DialogTitle>
              <DialogDescription>
                This will settle the full outstanding balance of{" "}
                <span className="text-yellow-400 font-medium">
                  {outstandingBalance.toFixed(2)}
                </span>{" "}
                and mark the invoice as paid.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMarkPaidOpen(false)}
                disabled={markPaid.isPending}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => markPaid.mutate({ id: invoiceId })}
                disabled={markPaid.isPending}
                className="bg-[#00d992] text-gray-950 hover:bg-[#00d992]/90"
              >
                {markPaid.isPending ? "Processing…" : "Confirm Mark Paid"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Void */}
      {canVoid && (
        <Dialog open={voidOpen} onOpenChange={setVoidOpen}>
          <DialogTrigger asChild>
            <button
              type="button"
              className="rounded border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-400 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Void
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Void Invoice</DialogTitle>
              <DialogDescription>
                This will permanently void the invoice. This action cannot be
                undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVoidOpen(false)}
                disabled={voidInvoice.isPending}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => voidInvoice.mutate({ id: invoiceId })}
                disabled={voidInvoice.isPending}
              >
                {voidInvoice.isPending ? "Voiding…" : "Confirm Void"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
