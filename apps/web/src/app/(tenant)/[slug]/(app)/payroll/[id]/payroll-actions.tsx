"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PayrollActionsProps {
  payrollId: string;
  status: string;
}

/**
 * Payroll lifecycle controls (DECISIONS_LOG §C):
 *   draft → [Process] → processing → [Approve] → approved → [Mark Paid + FundSource] → paid
 * Process computes PH statutory deductions; Mark Paid posts the JE + deducts the chosen fund source.
 */
export function PayrollActions({ payrollId, status }: PayrollActionsProps) {
  const router = useRouter();
  const [fundSourceId, setFundSourceId] = useState("");

  const { data: fundData } = trpc.banking.list.useQuery(
    { limit: 200, isActive: true },
    { enabled: status === "approved" },
  );
  const fundSources = fundData?.items ?? [];

  const refresh = () => router.refresh();
  const onError = (e: { message: string }) => toast.error(e.message);

  const processMut = trpc.payroll.process.useMutation({
    onSuccess: () => {
      toast.success("Statutory deductions computed. Run is now Processing.");
      refresh();
    },
    onError,
  });
  const approveMut = trpc.payroll.approve.useMutation({
    onSuccess: () => {
      toast.success("Payroll approved.");
      refresh();
    },
    onError,
  });
  const markPaidMut = trpc.payroll.markPaid.useMutation({
    onSuccess: () => {
      toast.success("Payroll paid: fund source deducted and journal entry posted.");
      refresh();
    },
    onError,
  });

  if (status === "draft") {
    return (
      <Button
        onClick={() => processMut.mutate({ id: payrollId })}
        disabled={processMut.isPending}
      >
        {processMut.isPending ? "Computing…" : "Process (compute statutory)"}
      </Button>
    );
  }

  if (status === "processing") {
    return (
      <Button onClick={() => approveMut.mutate({ id: payrollId })} disabled={approveMut.isPending}>
        {approveMut.isPending ? "Approving…" : "Approve"}
      </Button>
    );
  }

  if (status === "approved") {
    return (
      <div className="flex items-center gap-2">
        <Select value={fundSourceId} onValueChange={setFundSourceId}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Select fund source…" />
          </SelectTrigger>
          <SelectContent>
            {fundSources.map((fs) => (
              <SelectItem key={fs.id} value={fs.id}>
                {fs.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          onClick={() => {
            if (fundSourceId === "") {
              toast.error("Select a fund source to pay from.");
              return;
            }
            markPaidMut.mutate({ id: payrollId, fundSourceId });
          }}
          disabled={markPaidMut.isPending}
        >
          {markPaidMut.isPending ? "Posting…" : "Mark Paid"}
        </Button>
      </div>
    );
  }

  return null;
}
