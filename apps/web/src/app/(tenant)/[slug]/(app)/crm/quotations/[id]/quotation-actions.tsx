"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface QuotationActionsProps {
  quotationId: string;
  status: string;
  convertedToInvoiceId: string | null;
  slug: string;
}

export function QuotationActions({
  quotationId,
  status,
  convertedToInvoiceId,
  slug,
}: QuotationActionsProps) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  const send = trpc.crm.quotationSend.useMutation({
    onSuccess: () => {
      toast.success("Quotation sent.");
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
    onSettled: () => setPending(null),
  });

  const accept = trpc.crm.quotationAccept.useMutation({
    onSuccess: () => {
      toast.success("Quotation accepted.");
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
    onSettled: () => setPending(null),
  });

  const reject = trpc.crm.quotationReject.useMutation({
    onSuccess: () => {
      toast.success("Quotation rejected.");
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
    onSettled: () => setPending(null),
  });

  const createRevision = trpc.crm.quotationCreateRevision.useMutation({
    onSuccess: () => {
      toast.success("Revision created. Quotation is back in draft.");
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
    onSettled: () => setPending(null),
  });

  const convertToInvoice = trpc.crm.quotationConvertToInvoice.useMutation({
    onSuccess: (data) => {
      toast.success(`Invoice ${data.invoiceNumber} created.`);
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
    onSettled: () => setPending(null),
  });

  const isPending = pending !== null;
  const canEditDraft = status === "draft";
  const canSend = status === "draft";
  const canAcceptReject = status === "sent";
  const canRevise = status !== "converted";
  const canConvert = status === "accepted" && convertedToInvoiceId === null;

  return (
    <div className="flex flex-wrap gap-2">
      {canEditDraft ? (
        <Link
          href={`/${slug}/crm/quotations/${quotationId}/edit`}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
        >
          Edit draft
        </Link>
      ) : null}
      <button
        type="button"
        disabled={!canSend || isPending}
        onClick={() => {
          setPending("send");
          send.mutate({ id: quotationId });
        }}
        className="rounded-md border border-sky-400 bg-sky-400/10 px-3 py-1.5 text-xs font-medium text-sky-400 hover:bg-sky-400/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending === "send" ? "Sending…" : "Send"}
      </button>
      <button
        type="button"
        disabled={!canAcceptReject || isPending}
        onClick={() => {
          setPending("accept");
          accept.mutate({ id: quotationId });
        }}
        className="rounded-md border border-primary bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending === "accept" ? "Accepting…" : "Accept"}
      </button>
      <button
        type="button"
        disabled={!canAcceptReject || isPending}
        onClick={() => {
          setPending("reject");
          reject.mutate({ id: quotationId });
        }}
        className="rounded-md border border-red-400 bg-red-400/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-400/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending === "reject" ? "Rejecting…" : "Reject"}
      </button>
      <button
        type="button"
        disabled={!canRevise || isPending}
        onClick={() => {
          setPending("revise");
          createRevision.mutate({ id: quotationId });
        }}
        className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending === "revise" ? "Creating…" : "Create revision"}
      </button>
      <button
        type="button"
        disabled={!canConvert || isPending}
        onClick={() => {
          setPending("convert");
          convertToInvoice.mutate({ id: quotationId });
        }}
        className="rounded-md border border-amber-400 bg-amber-400/10 px-3 py-1.5 text-xs font-medium text-amber-400 hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending === "convert" ? "Converting…" : "Convert to invoice"}
      </button>
    </div>
  );
}
