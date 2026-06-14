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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ── constants ────────────────────────────────────────────────────────────────

const FUND_SOURCE_TYPES = [
  "cash_on_hand",
  "e_wallet",
  "bank",
  "credit_card",
  "loan",
] as const;
type FundSourceType = (typeof FUND_SOURCE_TYPES)[number];

const TYPE_LABELS: Record<FundSourceType, string> = {
  cash_on_hand: "Cash on Hand",
  e_wallet: "E-Wallet",
  bank: "Bank Account",
  credit_card: "Credit Card",
  loan: "Loan",
};

// ── helpers ───────────────────────────────────────────────────────────────────

function emptyForm() {
  return {
    name: "",
    type: "bank" as FundSourceType,
    initialBalance: "",
    currency: "PHP",
    bankName: "",
    accountNumber: "",
    creditLimit: "",
    loanProvider: "",
    loanPrincipal: "",
    loanInterestRate: "",
  };
}

// ── Add Fund Source ───────────────────────────────────────────────────────────

export function AddFundSourceButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState(emptyForm());
  const [error, setError] = useState<string | null>(null);

  const create = trpc.banking.create.useMutation({
    onSuccess: () => {
      toast.success("Fund source created.");
      router.refresh();
      setOpen(false);
      setFields(emptyForm());
      setError(null);
    },
    onError: (err) => {
      toast.error(err.message);
      setError(err.message);
    },
  });

  function set(key: keyof ReturnType<typeof emptyForm>, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
    setError(null);
  }

  function handleSubmit() {
    setError(null);
    if (!fields.name.trim()) {
      setError("Name is required.");
      return;
    }

    const initialBalance = fields.initialBalance === "" ? 0 : Number(fields.initialBalance);
    if (isNaN(initialBalance)) {
      setError("Initial balance must be a number.");
      return;
    }

    create.mutate({
      name: fields.name.trim(),
      type: fields.type,
      initialBalance,
      currency: fields.currency.trim() || "PHP",
      ...(fields.bankName.trim() ? { bankName: fields.bankName.trim() } : {}),
      ...(fields.accountNumber.trim()
        ? { accountNumber: fields.accountNumber.trim() }
        : {}),
      ...(fields.type === "credit_card" && fields.creditLimit !== ""
        ? { creditLimit: Number(fields.creditLimit) }
        : {}),
      ...(fields.type === "loan" && fields.loanProvider.trim()
        ? { loanProvider: fields.loanProvider.trim() }
        : {}),
      ...(fields.type === "loan" && fields.loanPrincipal !== ""
        ? { loanPrincipal: Number(fields.loanPrincipal) }
        : {}),
      ...(fields.type === "loan" && fields.loanInterestRate !== ""
        ? { loanInterestRate: Number(fields.loanInterestRate) }
        : {}),
    });
  }

  const isCreditCard = fields.type === "credit_card";
  const isLoan = fields.type === "loan";
  const hasBank = fields.type === "bank" || fields.type === "e_wallet";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setFields(emptyForm());
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="bg-[#00d992] text-gray-950 hover:bg-[#00d992]/90 h-7 px-3 text-xs font-medium"
        >
          Add Fund Source
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Fund Source</DialogTitle>
          <DialogDescription>
            Create a new fund source to track cash, bank accounts, e-wallets,
            credit cards, or loans.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              Name <span className="text-red-400">*</span>
            </Label>
            <Input
              value={fields.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. BDO Checking"
            />
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              Type <span className="text-red-400">*</span>
            </Label>
            <Select
              value={fields.type}
              onValueChange={(v) => set("type", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FUND_SOURCE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Currency + Initial Balance */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Currency
              </Label>
              <Input
                value={fields.currency}
                maxLength={3}
                onChange={(e) => set("currency", e.target.value.toUpperCase())}
                placeholder="PHP"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Initial Balance
              </Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={fields.initialBalance}
                onChange={(e) => set("initialBalance", e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Bank-like fields */}
          {(hasBank || fields.type === "bank") && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Bank / Provider Name{" "}
                <span className="font-normal text-muted-foreground/60">
                  (optional)
                </span>
              </Label>
              <Input
                value={fields.bankName}
                onChange={(e) => set("bankName", e.target.value)}
                placeholder="BDO, BPI, GCash…"
              />
            </div>
          )}

          {/* Account Number */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              Account Number{" "}
              <span className="font-normal text-muted-foreground/60">
                (optional)
              </span>
            </Label>
            <Input
              value={fields.accountNumber}
              onChange={(e) => set("accountNumber", e.target.value)}
              placeholder="…1234"
            />
          </div>

          {/* Credit-card-specific */}
          {isCreditCard && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Credit Limit{" "}
                <span className="font-normal text-muted-foreground/60">
                  (optional)
                </span>
              </Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={fields.creditLimit}
                onChange={(e) => set("creditLimit", e.target.value)}
                placeholder="50000.00"
              />
            </div>
          )}

          {/* Loan-specific */}
          {isLoan && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  Loan Provider{" "}
                  <span className="font-normal text-muted-foreground/60">
                    (optional)
                  </span>
                </Label>
                <Input
                  value={fields.loanProvider}
                  onChange={(e) => set("loanProvider", e.target.value)}
                  placeholder="SSS, HDMF, Bank…"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Principal{" "}
                    <span className="font-normal text-muted-foreground/60">
                      (optional)
                    </span>
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={fields.loanPrincipal}
                    onChange={(e) => set("loanPrincipal", e.target.value)}
                    placeholder="100000.00"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Interest Rate %{" "}
                    <span className="font-normal text-muted-foreground/60">
                      (optional)
                    </span>
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={fields.loanInterestRate}
                    onChange={(e) => set("loanInterestRate", e.target.value)}
                    placeholder="6.50"
                  />
                </div>
              </div>
            </>
          )}

          {error !== null && (
            <p className="text-xs text-red-400">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setFields(emptyForm());
              setError(null);
              setOpen(false);
            }}
            disabled={create.isPending}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={create.isPending}
            className="bg-[#00d992] text-gray-950 hover:bg-[#00d992]/90"
          >
            {create.isPending ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Edit Fund Source ──────────────────────────────────────────────────────────

interface EditFundSourceButtonProps {
  fundSource: {
    id: string;
    name: string;
    type: string;
    bankName: string | null;
    accountNumber: string | null;
    creditLimit?: unknown;
    loanProvider?: string | null;
    loanPrincipal?: unknown;
    loanInterestRate?: unknown;
  };
}

export function EditFundSourceButton({ fundSource }: EditFundSourceButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(fundSource.name);
  const [bankName, setBankName] = useState(fundSource.bankName ?? "");
  const [accountNumber, setAccountNumber] = useState(
    fundSource.accountNumber ?? ""
  );
  const [creditLimit, setCreditLimit] = useState(
    fundSource.creditLimit != null ? String(Number(fundSource.creditLimit)) : ""
  );
  const [loanProvider, setLoanProvider] = useState(
    fundSource.loanProvider ?? ""
  );
  const [loanPrincipal, setLoanPrincipal] = useState(
    fundSource.loanPrincipal != null
      ? String(Number(fundSource.loanPrincipal))
      : ""
  );
  const [loanInterestRate, setLoanInterestRate] = useState(
    fundSource.loanInterestRate != null
      ? String(Number(fundSource.loanInterestRate))
      : ""
  );
  const [error, setError] = useState<string | null>(null);

  const update = trpc.banking.update.useMutation({
    onSuccess: () => {
      toast.success("Fund source updated.");
      router.refresh();
      setOpen(false);
      setError(null);
    },
    onError: (err) => {
      toast.error(err.message);
      setError(err.message);
    },
  });

  const isCreditCard = fundSource.type === "credit_card";
  const isLoan = fundSource.type === "loan";

  function handleSubmit() {
    setError(null);
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    update.mutate({
      id: fundSource.id,
      ...(name.trim() !== fundSource.name ? { name: name.trim() } : {}),
      ...(bankName.trim() ? { bankName: bankName.trim() } : {}),
      ...(accountNumber.trim() ? { accountNumber: accountNumber.trim() } : {}),
      ...(isCreditCard && creditLimit !== ""
        ? { creditLimit: Number(creditLimit) }
        : {}),
      ...(isLoan && loanProvider.trim()
        ? { loanProvider: loanProvider.trim() }
        : {}),
      ...(isLoan && loanPrincipal !== ""
        ? { loanPrincipal: Number(loanPrincipal) }
        : {}),
      ...(isLoan && loanInterestRate !== ""
        ? { loanInterestRate: Number(loanInterestRate) }
        : {}),
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="rounded border border-border bg-muted/40 px-2 py-0.5 text-xs font-medium text-muted-foreground hover:bg-muted/70 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Edit
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Fund Source</DialogTitle>
          <DialogDescription>
            Update name and metadata. Type and currency cannot be changed after
            creation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              Name <span className="text-red-400">*</span>
            </Label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
            />
          </div>

          {/* Bank name */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              Bank / Provider Name{" "}
              <span className="font-normal text-muted-foreground/60">
                (optional)
              </span>
            </Label>
            <Input
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="BDO, BPI, GCash…"
            />
          </div>

          {/* Account Number */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              Account Number{" "}
              <span className="font-normal text-muted-foreground/60">
                (optional)
              </span>
            </Label>
            <Input
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="…1234"
            />
          </div>

          {/* Credit-card */}
          {isCreditCard && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Credit Limit{" "}
                <span className="font-normal text-muted-foreground/60">
                  (optional)
                </span>
              </Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={creditLimit}
                onChange={(e) => setCreditLimit(e.target.value)}
                placeholder="50000.00"
              />
            </div>
          )}

          {/* Loan */}
          {isLoan && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  Loan Provider{" "}
                  <span className="font-normal text-muted-foreground/60">
                    (optional)
                  </span>
                </Label>
                <Input
                  value={loanProvider}
                  onChange={(e) => setLoanProvider(e.target.value)}
                  placeholder="SSS, HDMF, Bank…"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Principal
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={loanPrincipal}
                    onChange={(e) => setLoanPrincipal(e.target.value)}
                    placeholder="100000.00"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Interest Rate %
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={loanInterestRate}
                    onChange={(e) => setLoanInterestRate(e.target.value)}
                    placeholder="6.50"
                  />
                </div>
              </div>
            </>
          )}

          {error !== null && (
            <p className="text-xs text-red-400">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setError(null);
              setOpen(false);
            }}
            disabled={update.isPending}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={update.isPending}
            className="bg-[#00d992] text-gray-950 hover:bg-[#00d992]/90"
          >
            {update.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Toggle Active ─────────────────────────────────────────────────────────────

interface ToggleFundSourceButtonProps {
  id: string;
  isActive: boolean;
}

export function ToggleFundSourceButton({
  id,
  isActive,
}: ToggleFundSourceButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const toggle = trpc.banking.toggleActive.useMutation({
    onSuccess: () => {
      toast.success(isActive ? "Fund source deactivated." : "Fund source activated.");
      router.refresh();
      setOpen(false);
    },
    onError: (err) => {
      toast.error(err.message);
      setOpen(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={`rounded border px-2 py-0.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
            isActive
              ? "border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20"
              : "border-[#00d992]/40 bg-[#00d992]/10 text-[#00d992] hover:bg-[#00d992]/20"
          }`}
        >
          {isActive ? "Deactivate" : "Activate"}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {isActive ? "Deactivate" : "Activate"} Fund Source
          </DialogTitle>
          <DialogDescription>
            {isActive
              ? "This fund source will be hidden from active lists but all transactions will be preserved."
              : "This fund source will be available for transactions again."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOpen(false)}
            disabled={toggle.isPending}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            variant={isActive ? "destructive" : "default"}
            onClick={() => toggle.mutate({ id })}
            disabled={toggle.isPending}
            className={
              !isActive
                ? "bg-[#00d992] text-gray-950 hover:bg-[#00d992]/90"
                : undefined
            }
          >
            {toggle.isPending
              ? "Updating…"
              : isActive
              ? "Confirm Deactivate"
              : "Confirm Activate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
