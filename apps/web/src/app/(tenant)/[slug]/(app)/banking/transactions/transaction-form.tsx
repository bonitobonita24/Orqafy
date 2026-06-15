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
import { Textarea } from "@/components/ui/textarea";

// ── types ─────────────────────────────────────────────────────────────────────

type ActionKey =
  | "recordIncome"
  | "recordExpense"
  | "transfer"
  | "recordCreditCardCharge"
  | "payCreditCard"
  | "loanMoneyOutTo"
  | "loanMoneyIn"
  | "recordRefund"
  | "recordAdjustment";

const ACTION_LABELS: Record<ActionKey, string> = {
  recordIncome: "Record Income",
  recordExpense: "Record Expense",
  transfer: "Transfer Between Accounts",
  recordCreditCardCharge: "Credit Card Charge",
  payCreditCard: "Pay Credit Card",
  loanMoneyOutTo: "Loan Money Out To",
  loanMoneyIn: "Loan Repayment In",
  recordRefund: "Record Refund",
  recordAdjustment: "Record Adjustment",
};

const ACTION_KEYS = Object.keys(ACTION_LABELS) as ActionKey[];

// fund source shape from trpc.banking.list
interface FundSourceOption {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
}

// ── helpers ───────────────────────────────────────────────────────────────────

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── inner form states ─────────────────────────────────────────────────────────

function useFundSources() {
  const { data } = trpc.banking.list.useQuery({ limit: 200 });
  return (data?.items ?? []) as FundSourceOption[];
}

// ── sub-form components ───────────────────────────────────────────────────────

function FieldAmount({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        Amount <span className="text-red-400">*</span>
      </Label>
      <Input
        type="number"
        min={0.01}
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0.00"
      />
    </div>
  );
}

function FieldFundSource({
  label,
  value,
  onChange,
  sources,
  excludeId,
  filterType,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  sources: FundSourceOption[];
  excludeId?: string;
  filterType?: string;
}) {
  const filtered = sources.filter(
    (s) =>
      s.isActive &&
      (excludeId === undefined || s.id !== excludeId) &&
      (filterType === undefined || s.type === filterType)
  );
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        {label} <span className="text-red-400">*</span>
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select fund source…" />
        </SelectTrigger>
        <SelectContent>
          {filtered.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function FieldDescription({
  value,
  onChange,
  required,
}: {
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        Description{" "}
        {required === true ? (
          <span className="text-red-400">*</span>
        ) : (
          <span className="font-normal text-muted-foreground/60">(optional)</span>
        )}
      </Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Brief description…"
      />
    </div>
  );
}

function FieldCategory({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        Category{" "}
        <span className="font-normal text-muted-foreground/60">(optional)</span>
      </Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. Utilities, Salary…"
      />
    </div>
  );
}

function FieldDate({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        Transaction Date{" "}
        <span className="font-normal text-muted-foreground/60">(optional)</span>
      </Label>
      <Input type="date" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

// ── confirm wrapper ───────────────────────────────────────────────────────────

function ConfirmStep({
  label,
  onConfirm,
  onBack,
  isPending,
  children,
}: {
  label: string;
  onConfirm: () => void;
  onBack: () => void;
  isPending: boolean;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-400">
        Please review the details below before confirming.
      </div>
      <div className="space-y-2 text-sm text-muted-foreground">{children}</div>
      <DialogFooter>
        <Button variant="outline" size="sm" onClick={onBack} disabled={isPending}>
          Back
        </Button>
        <Button
          size="sm"
          onClick={onConfirm}
          disabled={isPending}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {isPending ? "Processing…" : `Confirm ${label}`}
        </Button>
      </DialogFooter>
    </>
  );
}

// ── per-action form bodies ────────────────────────────────────────────────────

function RecordIncomeForm({
  sources,
  prefillFundSourceId,
  onSuccess,
}: {
  sources: FundSourceOption[];
  prefillFundSourceId?: string | undefined;
  onSuccess: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [fundSourceId, setFundSourceId] = useState(prefillFundSourceId ?? "");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [transactionDate, setTransactionDate] = useState(todayIso());
  const [error, setError] = useState<string | null>(null);

  const mutate = trpc.banking.transaction.recordIncome.useMutation({
    onSuccess: () => {
      toast.success("Income recorded.");
      router.refresh();
      onSuccess();
    },
    onError: (err) => {
      toast.error(err.message);
      setStep("form");
    },
  });

  function validate() {
    if (!fundSourceId) return "Fund source is required.";
    if (!amount || Number(amount) <= 0) return "Amount must be positive.";
    return null;
  }

  if (step === "confirm") {
    const src = sources.find((s) => s.id === fundSourceId);
    return (
      <ConfirmStep
        label="Income"
        onConfirm={() =>
          mutate.mutate({
            fundSourceId,
            amount: Number(amount),
            ...(description.trim() ? { description: description.trim() } : {}),
            ...(category.trim() ? { category: category.trim() } : {}),
            ...(transactionDate ? { transactionDate } : {}),
          })
        }
        onBack={() => setStep("form")}
        isPending={mutate.isPending}
      >
        <p>Fund Source: <span className="text-foreground">{src?.name ?? fundSourceId}</span></p>
        <p>Amount: <span className="text-primary font-mono">+{amount}</span></p>
        {description && <p>Description: <span className="text-foreground">{description}</span></p>}
        {category && <p>Category: <span className="text-foreground">{category}</span></p>}
        <p>Date: <span className="text-foreground">{transactionDate}</span></p>
      </ConfirmStep>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <FieldFundSource label="Fund Source" value={fundSourceId} onChange={setFundSourceId} sources={sources} />
        <FieldAmount value={amount} onChange={setAmount} />
        <FieldDescription value={description} onChange={setDescription} />
        <FieldCategory value={category} onChange={setCategory} />
        <FieldDate value={transactionDate} onChange={setTransactionDate} />
        {error !== null && <p className="text-xs text-red-400">{error}</p>}
      </div>
      <DialogFooter>
        <Button
          size="sm"
          onClick={() => {
            const e = validate();
            if (e) { setError(e); return; }
            setError(null);
            setStep("confirm");
          }}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Next
        </Button>
      </DialogFooter>
    </>
  );
}

function RecordExpenseForm({
  sources,
  prefillFundSourceId,
  onSuccess,
}: {
  sources: FundSourceOption[];
  prefillFundSourceId?: string | undefined;
  onSuccess: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [fundSourceId, setFundSourceId] = useState(prefillFundSourceId ?? "");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [transactionDate, setTransactionDate] = useState(todayIso());
  const [error, setError] = useState<string | null>(null);

  const mutate = trpc.banking.transaction.recordExpense.useMutation({
    onSuccess: () => {
      toast.success("Expense recorded.");
      router.refresh();
      onSuccess();
    },
    onError: (err) => {
      toast.error(err.message);
      setStep("form");
    },
  });

  function validate() {
    if (!fundSourceId) return "Fund source is required.";
    if (!amount || Number(amount) <= 0) return "Amount must be positive.";
    return null;
  }

  if (step === "confirm") {
    const src = sources.find((s) => s.id === fundSourceId);
    return (
      <ConfirmStep
        label="Expense"
        onConfirm={() =>
          mutate.mutate({
            fundSourceId,
            amount: Number(amount),
            ...(description.trim() ? { description: description.trim() } : {}),
            ...(category.trim() ? { category: category.trim() } : {}),
            ...(transactionDate ? { transactionDate } : {}),
          })
        }
        onBack={() => setStep("form")}
        isPending={mutate.isPending}
      >
        <p>Fund Source: <span className="text-foreground">{src?.name ?? fundSourceId}</span></p>
        <p>Amount: <span className="text-red-400 font-mono">-{amount}</span></p>
        {description && <p>Description: <span className="text-foreground">{description}</span></p>}
        {category && <p>Category: <span className="text-foreground">{category}</span></p>}
        <p>Date: <span className="text-foreground">{transactionDate}</span></p>
      </ConfirmStep>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <FieldFundSource label="Fund Source" value={fundSourceId} onChange={setFundSourceId} sources={sources} />
        <FieldAmount value={amount} onChange={setAmount} />
        <FieldDescription value={description} onChange={setDescription} />
        <FieldCategory value={category} onChange={setCategory} />
        <FieldDate value={transactionDate} onChange={setTransactionDate} />
        {error !== null && <p className="text-xs text-red-400">{error}</p>}
      </div>
      <DialogFooter>
        <Button
          size="sm"
          onClick={() => {
            const e = validate();
            if (e) { setError(e); return; }
            setError(null);
            setStep("confirm");
          }}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Next
        </Button>
      </DialogFooter>
    </>
  );
}

function TransferForm({
  sources,
  prefillFundSourceId,
  onSuccess,
}: {
  sources: FundSourceOption[];
  prefillFundSourceId?: string | undefined;
  onSuccess: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [fromId, setFromId] = useState(prefillFundSourceId ?? "");
  const [toId, setToId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [transactionDate, setTransactionDate] = useState(todayIso());
  const [error, setError] = useState<string | null>(null);

  const mutate = trpc.banking.transaction.transfer.useMutation({
    onSuccess: () => {
      toast.success("Transfer completed.");
      router.refresh();
      onSuccess();
    },
    onError: (err) => {
      toast.error(err.message);
      setStep("form");
    },
  });

  function validate() {
    if (!fromId) return "Source fund source is required.";
    if (!toId) return "Destination fund source is required.";
    if (fromId === toId) return "Source and destination must be different.";
    if (!amount || Number(amount) <= 0) return "Amount must be positive.";
    return null;
  }

  if (step === "confirm") {
    const from = sources.find((s) => s.id === fromId);
    const to = sources.find((s) => s.id === toId);
    return (
      <ConfirmStep
        label="Transfer"
        onConfirm={() =>
          mutate.mutate({
            fromFundSourceId: fromId,
            toFundSourceId: toId,
            amount: Number(amount),
            ...(description.trim() ? { description: description.trim() } : {}),
            ...(transactionDate ? { transactionDate } : {}),
          })
        }
        onBack={() => setStep("form")}
        isPending={mutate.isPending}
      >
        <p>From: <span className="text-foreground">{from?.name ?? fromId}</span></p>
        <p>To: <span className="text-foreground">{to?.name ?? toId}</span></p>
        <p>Amount: <span className="text-foreground font-mono">{amount}</span></p>
        {description && <p>Description: <span className="text-foreground">{description}</span></p>}
        <p>Date: <span className="text-foreground">{transactionDate}</span></p>
      </ConfirmStep>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <FieldFundSource label="From" value={fromId} onChange={(v) => { setFromId(v); if (v === toId) setToId(""); }} sources={sources} excludeId={toId} />
        <FieldFundSource label="To" value={toId} onChange={(v) => { setToId(v); }} sources={sources} excludeId={fromId} />
        <FieldAmount value={amount} onChange={setAmount} />
        <FieldDescription value={description} onChange={setDescription} />
        <FieldDate value={transactionDate} onChange={setTransactionDate} />
        {error !== null && <p className="text-xs text-red-400">{error}</p>}
      </div>
      <DialogFooter>
        <Button
          size="sm"
          onClick={() => {
            const e = validate();
            if (e) { setError(e); return; }
            setError(null);
            setStep("confirm");
          }}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Next
        </Button>
      </DialogFooter>
    </>
  );
}

function CreditCardChargeForm({
  sources,
  prefillFundSourceId,
  onSuccess,
}: {
  sources: FundSourceOption[];
  prefillFundSourceId?: string | undefined;
  onSuccess: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [fundSourceId, setFundSourceId] = useState(prefillFundSourceId ?? "");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [transactionDate, setTransactionDate] = useState(todayIso());
  const [error, setError] = useState<string | null>(null);

  const creditCardSources = sources.filter((s) => s.isActive && s.type === "credit_card");

  const mutate = trpc.banking.transaction.recordCreditCardCharge.useMutation({
    onSuccess: () => {
      toast.success("Credit card charge recorded.");
      router.refresh();
      onSuccess();
    },
    onError: (err) => {
      toast.error(err.message);
      setStep("form");
    },
  });

  function validate() {
    if (!fundSourceId) return "Credit card fund source is required.";
    if (!amount || Number(amount) <= 0) return "Amount must be positive.";
    return null;
  }

  if (step === "confirm") {
    const src = sources.find((s) => s.id === fundSourceId);
    return (
      <ConfirmStep
        label="Charge"
        onConfirm={() =>
          mutate.mutate({
            fundSourceId,
            amount: Number(amount),
            ...(description.trim() ? { description: description.trim() } : {}),
            ...(category.trim() ? { category: category.trim() } : {}),
            ...(transactionDate ? { transactionDate } : {}),
          })
        }
        onBack={() => setStep("form")}
        isPending={mutate.isPending}
      >
        <p>Credit Card: <span className="text-foreground">{src?.name ?? fundSourceId}</span></p>
        <p>Charge Amount: <span className="text-red-400 font-mono">{amount}</span></p>
        {description && <p>Description: <span className="text-foreground">{description}</span></p>}
        {category && <p>Category: <span className="text-foreground">{category}</span></p>}
        <p>Date: <span className="text-foreground">{transactionDate}</span></p>
      </ConfirmStep>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">
            Credit Card <span className="text-red-400">*</span>
          </Label>
          <Select value={fundSourceId} onValueChange={setFundSourceId}>
            <SelectTrigger>
              <SelectValue placeholder="Select credit card…" />
            </SelectTrigger>
            <SelectContent>
              {creditCardSources.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <FieldAmount value={amount} onChange={setAmount} />
        <FieldDescription value={description} onChange={setDescription} />
        <FieldCategory value={category} onChange={setCategory} />
        <FieldDate value={transactionDate} onChange={setTransactionDate} />
        {error !== null && <p className="text-xs text-red-400">{error}</p>}
      </div>
      <DialogFooter>
        <Button
          size="sm"
          onClick={() => {
            const e = validate();
            if (e) { setError(e); return; }
            setError(null);
            setStep("confirm");
          }}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Next
        </Button>
      </DialogFooter>
    </>
  );
}

function PayCreditCardForm({
  sources,
  prefillFundSourceId,
  onSuccess,
}: {
  sources: FundSourceOption[];
  prefillFundSourceId?: string | undefined;
  onSuccess: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [payerFundSourceId, setPayerFundSourceId] = useState(
    prefillFundSourceId !== undefined &&
    sources.find((s) => s.id === prefillFundSourceId)?.type !== "credit_card"
      ? prefillFundSourceId
      : ""
  );
  const [creditCardFundSourceId, setCreditCardFundSourceId] = useState(
    prefillFundSourceId !== undefined &&
    sources.find((s) => s.id === prefillFundSourceId)?.type === "credit_card"
      ? prefillFundSourceId
      : ""
  );
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [transactionDate, setTransactionDate] = useState(todayIso());
  const [error, setError] = useState<string | null>(null);

  const mutate = trpc.banking.transaction.payCreditCard.useMutation({
    onSuccess: () => {
      toast.success("Credit card payment recorded.");
      router.refresh();
      onSuccess();
    },
    onError: (err) => {
      toast.error(err.message);
      setStep("form");
    },
  });

  function validate() {
    if (!payerFundSourceId) return "Payer fund source is required.";
    if (!creditCardFundSourceId) return "Credit card fund source is required.";
    if (!amount || Number(amount) <= 0) return "Amount must be positive.";
    return null;
  }

  if (step === "confirm") {
    const payer = sources.find((s) => s.id === payerFundSourceId);
    const card = sources.find((s) => s.id === creditCardFundSourceId);
    return (
      <ConfirmStep
        label="CC Payment"
        onConfirm={() =>
          mutate.mutate({
            payerFundSourceId,
            creditCardFundSourceId,
            amount: Number(amount),
            ...(description.trim() ? { description: description.trim() } : {}),
            ...(transactionDate ? { transactionDate } : {}),
          })
        }
        onBack={() => setStep("form")}
        isPending={mutate.isPending}
      >
        <p>Pay From: <span className="text-foreground">{payer?.name ?? payerFundSourceId}</span></p>
        <p>Credit Card: <span className="text-foreground">{card?.name ?? creditCardFundSourceId}</span></p>
        <p>Amount: <span className="text-foreground font-mono">{amount}</span></p>
        {description && <p>Description: <span className="text-foreground">{description}</span></p>}
        <p>Date: <span className="text-foreground">{transactionDate}</span></p>
      </ConfirmStep>
    );
  }

  const nonCreditCardSources = sources.filter(
    (s) => s.isActive && s.type !== "credit_card"
  );
  const creditCardSources = sources.filter(
    (s) => s.isActive && s.type === "credit_card"
  );

  return (
    <>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">
            Pay From <span className="text-red-400">*</span>
          </Label>
          <Select value={payerFundSourceId} onValueChange={setPayerFundSourceId}>
            <SelectTrigger>
              <SelectValue placeholder="Select fund source…" />
            </SelectTrigger>
            <SelectContent>
              {nonCreditCardSources.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">
            Credit Card <span className="text-red-400">*</span>
          </Label>
          <Select value={creditCardFundSourceId} onValueChange={setCreditCardFundSourceId}>
            <SelectTrigger>
              <SelectValue placeholder="Select credit card…" />
            </SelectTrigger>
            <SelectContent>
              {creditCardSources.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <FieldAmount value={amount} onChange={setAmount} />
        <FieldDescription value={description} onChange={setDescription} />
        <FieldDate value={transactionDate} onChange={setTransactionDate} />
        {error !== null && <p className="text-xs text-red-400">{error}</p>}
      </div>
      <DialogFooter>
        <Button
          size="sm"
          onClick={() => {
            const e = validate();
            if (e) { setError(e); return; }
            setError(null);
            setStep("confirm");
          }}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Next
        </Button>
      </DialogFooter>
    </>
  );
}

function LoanMoneyOutToForm({
  sources,
  prefillFundSourceId,
  onSuccess,
}: {
  sources: FundSourceOption[];
  prefillFundSourceId?: string | undefined;
  onSuccess: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [loanFundSourceId, setLoanFundSourceId] = useState(
    prefillFundSourceId !== undefined &&
    sources.find((s) => s.id === prefillFundSourceId)?.type === "loan"
      ? prefillFundSourceId
      : ""
  );
  const [receiverFundSourceId, setReceiverFundSourceId] = useState(
    prefillFundSourceId !== undefined &&
    sources.find((s) => s.id === prefillFundSourceId)?.type !== "loan"
      ? prefillFundSourceId
      : ""
  );
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [transactionDate, setTransactionDate] = useState(todayIso());
  const [error, setError] = useState<string | null>(null);

  const mutate = trpc.banking.transaction.loanMoneyOutTo.useMutation({
    onSuccess: () => {
      toast.success("Loan disbursement recorded.");
      router.refresh();
      onSuccess();
    },
    onError: (err) => {
      toast.error(err.message);
      setStep("form");
    },
  });

  function validate() {
    if (!loanFundSourceId) return "Loan fund source is required.";
    if (!receiverFundSourceId) return "Receiver fund source is required.";
    if (!amount || Number(amount) <= 0) return "Amount must be positive.";
    return null;
  }

  if (step === "confirm") {
    const loan = sources.find((s) => s.id === loanFundSourceId);
    const receiver = sources.find((s) => s.id === receiverFundSourceId);
    return (
      <ConfirmStep
        label="Disbursement"
        onConfirm={() =>
          mutate.mutate({
            loanFundSourceId,
            receiverFundSourceId,
            amount: Number(amount),
            ...(description.trim() ? { description: description.trim() } : {}),
            ...(transactionDate ? { transactionDate } : {}),
          })
        }
        onBack={() => setStep("form")}
        isPending={mutate.isPending}
      >
        <p>Loan Source: <span className="text-foreground">{loan?.name ?? loanFundSourceId}</span></p>
        <p>Receiver: <span className="text-foreground">{receiver?.name ?? receiverFundSourceId}</span></p>
        <p>Amount: <span className="text-foreground font-mono">{amount}</span></p>
        {description && <p>Description: <span className="text-foreground">{description}</span></p>}
        <p>Date: <span className="text-foreground">{transactionDate}</span></p>
      </ConfirmStep>
    );
  }

  const loanSources = sources.filter((s) => s.isActive && s.type === "loan");

  return (
    <>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">
            Loan Source <span className="text-red-400">*</span>
          </Label>
          <Select value={loanFundSourceId} onValueChange={setLoanFundSourceId}>
            <SelectTrigger>
              <SelectValue placeholder="Select loan…" />
            </SelectTrigger>
            <SelectContent>
              {loanSources.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <FieldFundSource
          label="Receiver Fund Source"
          value={receiverFundSourceId}
          onChange={setReceiverFundSourceId}
          sources={sources}
        />
        <FieldAmount value={amount} onChange={setAmount} />
        <FieldDescription value={description} onChange={setDescription} />
        <FieldDate value={transactionDate} onChange={setTransactionDate} />
        {error !== null && <p className="text-xs text-red-400">{error}</p>}
      </div>
      <DialogFooter>
        <Button
          size="sm"
          onClick={() => {
            const e = validate();
            if (e) { setError(e); return; }
            setError(null);
            setStep("confirm");
          }}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Next
        </Button>
      </DialogFooter>
    </>
  );
}

function LoanMoneyInForm({
  sources,
  prefillFundSourceId,
  onSuccess,
}: {
  sources: FundSourceOption[];
  prefillFundSourceId?: string | undefined;
  onSuccess: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [payerFundSourceId, setPayerFundSourceId] = useState(
    prefillFundSourceId !== undefined &&
    sources.find((s) => s.id === prefillFundSourceId)?.type !== "loan"
      ? prefillFundSourceId
      : ""
  );
  const [loanFundSourceId, setLoanFundSourceId] = useState(
    prefillFundSourceId !== undefined &&
    sources.find((s) => s.id === prefillFundSourceId)?.type === "loan"
      ? prefillFundSourceId
      : ""
  );
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [transactionDate, setTransactionDate] = useState(todayIso());
  const [error, setError] = useState<string | null>(null);

  const mutate = trpc.banking.transaction.loanMoneyIn.useMutation({
    onSuccess: () => {
      toast.success("Loan repayment recorded.");
      router.refresh();
      onSuccess();
    },
    onError: (err) => {
      toast.error(err.message);
      setStep("form");
    },
  });

  function validate() {
    if (!payerFundSourceId) return "Payer fund source is required.";
    if (!loanFundSourceId) return "Loan fund source is required.";
    if (!amount || Number(amount) <= 0) return "Amount must be positive.";
    return null;
  }

  if (step === "confirm") {
    const payer = sources.find((s) => s.id === payerFundSourceId);
    const loan = sources.find((s) => s.id === loanFundSourceId);
    return (
      <ConfirmStep
        label="Repayment"
        onConfirm={() =>
          mutate.mutate({
            payerFundSourceId,
            loanFundSourceId,
            amount: Number(amount),
            ...(description.trim() ? { description: description.trim() } : {}),
            ...(transactionDate ? { transactionDate } : {}),
          })
        }
        onBack={() => setStep("form")}
        isPending={mutate.isPending}
      >
        <p>Pay From: <span className="text-foreground">{payer?.name ?? payerFundSourceId}</span></p>
        <p>Loan: <span className="text-foreground">{loan?.name ?? loanFundSourceId}</span></p>
        <p>Amount: <span className="text-foreground font-mono">{amount}</span></p>
        {description && <p>Description: <span className="text-foreground">{description}</span></p>}
        <p>Date: <span className="text-foreground">{transactionDate}</span></p>
      </ConfirmStep>
    );
  }

  const loanSources = sources.filter((s) => s.isActive && s.type === "loan");

  return (
    <>
      <div className="space-y-4">
        <FieldFundSource
          label="Pay From"
          value={payerFundSourceId}
          onChange={setPayerFundSourceId}
          sources={sources}
        />
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">
            Loan <span className="text-red-400">*</span>
          </Label>
          <Select value={loanFundSourceId} onValueChange={setLoanFundSourceId}>
            <SelectTrigger>
              <SelectValue placeholder="Select loan…" />
            </SelectTrigger>
            <SelectContent>
              {loanSources.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <FieldAmount value={amount} onChange={setAmount} />
        <FieldDescription value={description} onChange={setDescription} />
        <FieldDate value={transactionDate} onChange={setTransactionDate} />
        {error !== null && <p className="text-xs text-red-400">{error}</p>}
      </div>
      <DialogFooter>
        <Button
          size="sm"
          onClick={() => {
            const e = validate();
            if (e) { setError(e); return; }
            setError(null);
            setStep("confirm");
          }}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Next
        </Button>
      </DialogFooter>
    </>
  );
}

function RecordRefundForm({
  sources,
  prefillFundSourceId,
  onSuccess,
}: {
  sources: FundSourceOption[];
  prefillFundSourceId?: string | undefined;
  onSuccess: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [fundSourceId, setFundSourceId] = useState(prefillFundSourceId ?? "");
  const [amount, setAmount] = useState("");
  const [originalTransactionId, setOriginalTransactionId] = useState("");
  const [description, setDescription] = useState("");
  const [transactionDate, setTransactionDate] = useState(todayIso());
  const [error, setError] = useState<string | null>(null);

  const mutate = trpc.banking.transaction.recordRefund.useMutation({
    onSuccess: () => {
      toast.success("Refund recorded.");
      router.refresh();
      onSuccess();
    },
    onError: (err) => {
      toast.error(err.message);
      setStep("form");
    },
  });

  function validate() {
    if (!fundSourceId) return "Fund source is required.";
    if (!amount || Number(amount) <= 0) return "Amount must be positive.";
    return null;
  }

  if (step === "confirm") {
    const src = sources.find((s) => s.id === fundSourceId);
    return (
      <ConfirmStep
        label="Refund"
        onConfirm={() =>
          mutate.mutate({
            fundSourceId,
            amount: Number(amount),
            ...(originalTransactionId.trim()
              ? { originalTransactionId: originalTransactionId.trim() }
              : {}),
            ...(description.trim() ? { description: description.trim() } : {}),
            ...(transactionDate ? { transactionDate } : {}),
          })
        }
        onBack={() => setStep("form")}
        isPending={mutate.isPending}
      >
        <p>Fund Source: <span className="text-foreground">{src?.name ?? fundSourceId}</span></p>
        <p>Refund Amount: <span className="text-primary font-mono">+{amount}</span></p>
        {originalTransactionId && <p>Original Tx ID: <span className="text-foreground font-mono text-xs">{originalTransactionId}</span></p>}
        {description && <p>Description: <span className="text-foreground">{description}</span></p>}
        <p>Date: <span className="text-foreground">{transactionDate}</span></p>
      </ConfirmStep>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <FieldFundSource label="Fund Source" value={fundSourceId} onChange={setFundSourceId} sources={sources} />
        <FieldAmount value={amount} onChange={setAmount} />
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">
            Original Transaction ID{" "}
            <span className="font-normal text-muted-foreground/60">(optional)</span>
          </Label>
          <Input
            value={originalTransactionId}
            onChange={(e) => setOriginalTransactionId(e.target.value)}
            placeholder="Link to original outgoing transaction…"
            className="font-mono text-xs"
          />
        </div>
        <FieldDescription value={description} onChange={setDescription} />
        <FieldDate value={transactionDate} onChange={setTransactionDate} />
        {error !== null && <p className="text-xs text-red-400">{error}</p>}
      </div>
      <DialogFooter>
        <Button
          size="sm"
          onClick={() => {
            const e = validate();
            if (e) { setError(e); return; }
            setError(null);
            setStep("confirm");
          }}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Next
        </Button>
      </DialogFooter>
    </>
  );
}

function RecordAdjustmentForm({
  sources,
  prefillFundSourceId,
  onSuccess,
}: {
  sources: FundSourceOption[];
  prefillFundSourceId?: string | undefined;
  onSuccess: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "confirm">("form");
  // Only real-cash types allowed; filter server-side too but pre-filter for UX
  const realCashSources = sources.filter(
    (s) =>
      s.isActive &&
      ["cash_on_hand", "bank", "e_wallet"].includes(s.type)
  );
  const [fundSourceId, setFundSourceId] = useState(
    prefillFundSourceId !== undefined &&
    realCashSources.some((s) => s.id === prefillFundSourceId)
      ? prefillFundSourceId
      : ""
  );
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [transactionDate, setTransactionDate] = useState(todayIso());
  const [error, setError] = useState<string | null>(null);

  const mutate = trpc.banking.transaction.recordAdjustment.useMutation({
    onSuccess: () => {
      toast.success("Adjustment recorded.");
      router.refresh();
      onSuccess();
    },
    onError: (err) => {
      toast.error(err.message);
      setStep("form");
    },
  });

  function validate() {
    if (!fundSourceId) return "Fund source is required.";
    if (!delta || Number(delta) === 0) return "Delta must be non-zero.";
    if (!reason.trim()) return "Reason is required for adjustments.";
    return null;
  }

  if (step === "confirm") {
    const src = sources.find((s) => s.id === fundSourceId);
    const deltaNum = Number(delta);
    return (
      <ConfirmStep
        label="Adjustment"
        onConfirm={() =>
          mutate.mutate({
            fundSourceId,
            delta: deltaNum,
            reason: reason.trim(),
            ...(transactionDate ? { transactionDate } : {}),
          })
        }
        onBack={() => setStep("form")}
        isPending={mutate.isPending}
      >
        <p>Fund Source: <span className="text-foreground">{src?.name ?? fundSourceId}</span></p>
        <p>
          Delta:{" "}
          <span className={`font-mono ${deltaNum > 0 ? "text-primary" : "text-red-400"}`}>
            {deltaNum > 0 ? "+" : ""}{delta}
          </span>
        </p>
        <p>Reason: <span className="text-foreground">{reason}</span></p>
        <p>Date: <span className="text-foreground">{transactionDate}</span></p>
      </ConfirmStep>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">
            Fund Source (cash, bank, e-wallet only) <span className="text-red-400">*</span>
          </Label>
          <Select value={fundSourceId} onValueChange={setFundSourceId}>
            <SelectTrigger>
              <SelectValue placeholder="Select fund source…" />
            </SelectTrigger>
            <SelectContent>
              {realCashSources.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">
            Delta (positive = add, negative = subtract) <span className="text-red-400">*</span>
          </Label>
          <Input
            type="number"
            step="0.01"
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            placeholder="e.g. 500 or -200"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">
            Reason <span className="text-red-400">*</span>
          </Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why the balance is being adjusted…"
            rows={3}
            className="resize-none"
          />
        </div>
        <FieldDate value={transactionDate} onChange={setTransactionDate} />
        {error !== null && <p className="text-xs text-red-400">{error}</p>}
      </div>
      <DialogFooter>
        <Button
          size="sm"
          onClick={() => {
            const e = validate();
            if (e) { setError(e); return; }
            setError(null);
            setStep("confirm");
          }}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Next
        </Button>
      </DialogFooter>
    </>
  );
}

// ── action body router ────────────────────────────────────────────────────────

function ActionFormBody({
  action,
  sources,
  prefillFundSourceId,
  onSuccess,
}: {
  action: ActionKey;
  sources: FundSourceOption[];
  prefillFundSourceId?: string | undefined;
  onSuccess: () => void;
}) {
  const props = { sources, prefillFundSourceId, onSuccess };
  switch (action) {
    case "recordIncome": return <RecordIncomeForm {...props} />;
    case "recordExpense": return <RecordExpenseForm {...props} />;
    case "transfer": return <TransferForm {...props} />;
    case "recordCreditCardCharge": return <CreditCardChargeForm {...props} />;
    case "payCreditCard": return <PayCreditCardForm {...props} />;
    case "loanMoneyOutTo": return <LoanMoneyOutToForm {...props} />;
    case "loanMoneyIn": return <LoanMoneyInForm {...props} />;
    case "recordRefund": return <RecordRefundForm {...props} />;
    case "recordAdjustment": return <RecordAdjustmentForm {...props} />;
  }
}

// ── main exported component ───────────────────────────────────────────────────

interface NewTransactionButtonProps {
  /** When provided (from [fundSourceId]/transactions page), pre-fills the
   *  primary fund-source select for the chosen action. */
  prefillFundSourceId?: string | undefined;
}

export function NewTransactionButton({
  prefillFundSourceId,
}: NewTransactionButtonProps) {
  const sources = useFundSources();
  const [open, setOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<ActionKey | null>(null);

  function closeAll() {
    setOpen(false);
    setSelectedAction(null);
  }

  return (
    <>
      {/* Action picker */}
      <Dialog
        open={open && selectedAction === null}
        onOpenChange={(next) => {
          if (!next) setOpen(false);
          else setOpen(true);
        }}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
        >
          New Transaction
        </button>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New Transaction</DialogTitle>
            <DialogDescription>
              Choose the type of money movement to record.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-1.5">
            {ACTION_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedAction(key)}
                className="rounded-md border border-border bg-muted/30 px-3 py-2 text-left text-sm hover:bg-muted/60 transition-colors"
              >
                {ACTION_LABELS[key]}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Per-action dialog */}
      {selectedAction !== null && (
        <Dialog
          open={open && selectedAction !== null}
          onOpenChange={(next) => {
            if (!next) closeAll();
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{ACTION_LABELS[selectedAction]}</DialogTitle>
              <DialogDescription>
                Fill in the details below. All balance-affecting operations require
                confirmation before they are committed.
              </DialogDescription>
            </DialogHeader>
            <ActionFormBody
              action={selectedAction}
              sources={sources}
              prefillFundSourceId={prefillFundSourceId}
              onSuccess={closeAll}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
