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

interface CreditAccount {
  creditLimit: number;
  currentBalance: number;
  isActive: boolean;
}

interface CreditPanelProps {
  customerId: string;
  creditAccount: CreditAccount | null;
}

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-[#00d992] focus:outline-none";

function fmt(n: number) {
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
}

/* ── Configure / Edit Credit Dialog ──────────────────────────────────── */

function CreditUpsertDialog({
  customerId,
  creditAccount,
}: {
  customerId: string;
  creditAccount: CreditAccount | null;
}) {
  const router = useRouter();
  const isNew = creditAccount === null;
  const [open, setOpen] = useState(false);
  const [creditLimit, setCreditLimit] = useState(
    isNew ? "" : String(creditAccount.creditLimit),
  );
  const [isActive, setIsActive] = useState(isNew ? true : creditAccount.isActive);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setCreditLimit(isNew ? "" : String(creditAccount?.creditLimit ?? ""));
    setIsActive(isNew ? true : (creditAccount?.isActive ?? true));
    setError(null);
  }

  const upsert = trpc.crm.creditUpsert.useMutation({
    onSuccess: () => {
      toast.success(isNew ? "Credit account configured." : "Credit account updated.");
      router.refresh();
      setOpen(false);
    },
    onError: (err) => {
      setError(err.message);
      toast.error("Failed to save credit account.");
    },
  });

  function submit() {
    setError(null);
    const parsed = parseFloat(creditLimit);
    if (Number.isNaN(parsed) || parsed < 0) {
      setError("Credit limit must be a non-negative number.");
      return;
    }
    upsert.mutate({ customerId, creditLimit: parsed, isActive });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="rounded-md border border-[#00d992]/40 bg-[#00d992]/10 px-3 py-1.5 text-xs font-medium text-[#00d992] hover:bg-[#00d992]/20"
        >
          {isNew ? "Configure Credit" : "Edit Credit"}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {isNew ? "Configure Credit Account" : "Edit Credit Account"}
          </DialogTitle>
          <DialogDescription>
            Set the credit limit for this customer.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Credit Limit (₱) <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={creditLimit}
              onChange={(e) => setCreditLimit(e.target.value)}
              className={inputCls}
              placeholder="0.00"
            />
          </div>
          <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="accent-[#00d992]"
            />
            Credit account active
          </label>
          {error !== null && <p className="text-xs text-red-400">{error}</p>}
        </div>
        <DialogFooter>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={upsert.isPending}
            onClick={submit}
            className="rounded-md border border-[#00d992]/40 bg-[#00d992]/10 px-3 py-1.5 text-xs font-medium text-[#00d992] hover:bg-[#00d992]/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {upsert.isPending ? "Saving…" : "Save"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Toggle Credit Active Dialog ─────────────────────────────────────── */

function CreditToggleDialog({
  customerId,
  isActive,
}: {
  customerId: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const toggle = trpc.crm.creditToggleActive.useMutation({
    onSuccess: () => {
      toast.success(
        isActive ? "Credit account deactivated." : "Credit account activated.",
      );
      router.refresh();
      setOpen(false);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={
            isActive
              ? "rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
              : "rounded-md border border-[#00d992]/40 bg-[#00d992]/10 px-3 py-1.5 text-xs font-medium text-[#00d992] hover:bg-[#00d992]/20"
          }
        >
          {isActive ? "Deactivate Credit" : "Activate Credit"}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {isActive ? "Deactivate credit account?" : "Activate credit account?"}
          </DialogTitle>
          <DialogDescription>
            {isActive
              ? "The credit account will be suspended. Existing balance is preserved."
              : "The credit account will be re-enabled for use."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={toggle.isPending}
            onClick={() => toggle.mutate({ customerId })}
            className={
              isActive
                ? "rounded-md border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                : "rounded-md border border-[#00d992]/40 bg-[#00d992]/10 px-3 py-1.5 text-xs font-medium text-[#00d992] hover:bg-[#00d992]/20 disabled:cursor-not-allowed disabled:opacity-50"
            }
          >
            {toggle.isPending
              ? "Saving…"
              : isActive
                ? "Yes, Deactivate"
                : "Yes, Activate"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Credit Panel ─────────────────────────────────────────────────────── */

export function CreditPanel({ customerId, creditAccount }: CreditPanelProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Credit Account
        </h2>
        <div className="flex items-center gap-2">
          <CreditUpsertDialog customerId={customerId} creditAccount={creditAccount} />
          {creditAccount !== null && (
            <CreditToggleDialog
              customerId={customerId}
              isActive={creditAccount.isActive}
            />
          )}
        </div>
      </div>

      {creditAccount === null ? (
        <p className="text-sm text-muted-foreground">
          No credit account configured.
        </p>
      ) : (
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">Credit Limit</dt>
            <dd className="mt-0.5 text-sm font-medium">
              {fmt(creditAccount.creditLimit)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Current Balance</dt>
            <dd className="mt-0.5 text-sm font-medium">
              {fmt(creditAccount.currentBalance)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Status</dt>
            <dd className="mt-0.5">
              {creditAccount.isActive ? (
                <span className="rounded-full border border-[#00d992]/30 bg-[#00d992]/10 px-2 py-0.5 text-xs font-medium text-[#00d992]">
                  Active
                </span>
              ) : (
                <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  Inactive
                </span>
              )}
            </dd>
          </div>
        </dl>
      )}
    </div>
  );
}
