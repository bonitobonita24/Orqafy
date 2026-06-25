"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NONE = "__none__";

export function AccountingSettingsForm() {
  const router = useRouter();
  const { data: settings } = trpc.accounting.settings.get.useQuery();
  const { data: accountData } = trpc.accounting.account.list.useQuery({ limit: 200 });
  const { data: fyData } = trpc.accounting.fiscalYear.list.useQuery({ limit: 200 });

  const accounts = accountData?.items ?? [];
  const fiscalYears = fyData?.items ?? [];
  const assetAccounts = accounts.filter((a) => a.type === "asset");
  const liabilityAccounts = accounts.filter((a) => a.type === "liability");
  const expenseAccounts = accounts.filter((a) => a.type === "expense");

  const [inventory, setInventory] = useState(NONE);
  const [ap, setAp] = useState(NONE);
  const [expense, setExpense] = useState(NONE);
  const [inputVat, setInputVat] = useState(NONE);
  const [fiscalYear, setFiscalYear] = useState(NONE);

  useEffect(() => {
    if (settings === undefined) return;
    setInventory(settings.defaultInventoryAccountId ?? NONE);
    setAp(settings.defaultApAccountId ?? NONE);
    setExpense(settings.defaultExpenseAccountId ?? NONE);
    setInputVat(settings.defaultInputVatAccountId ?? NONE);
    setFiscalYear(settings.defaultFiscalYearId ?? NONE);
  }, [settings]);

  const updateMut = trpc.accounting.settings.update.useMutation({
    onSuccess: () => {
      toast.success("Accounting settings saved.");
      router.refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const toNull = (v: string) => (v === NONE ? null : v);

  const accountSelect = (
    label: string,
    hint: string,
    value: string,
    onChange: (v: string) => void,
    options: typeof accounts,
  ) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Not set" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>Not set</SelectItem>
          {options.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.code} — {a.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );

  return (
    <div className="max-w-2xl space-y-5 rounded-lg border border-border bg-card p-6">
      {accountSelect("Default Inventory Account (asset)", "Debited when stock is received via goods receipt.", inventory, setInventory, assetAccounts)}
      {accountSelect("Default Accounts Payable Account (liability)", "Credited on goods receipt and payroll.", ap, setAp, liabilityAccounts)}
      {accountSelect("Default Expense Account (expense)", "Debited for company/project expense receipts and payroll cost.", expense, setExpense, expenseAccounts)}
      {accountSelect("Default Input VAT Account (asset)", "Debited for the 12% input VAT on VAT-able purchase orders (D-2 R1).", inputVat, setInputVat, assetAccounts)}

      <div className="space-y-1.5">
        <Label>Default Fiscal Year</Label>
        <Select value={fiscalYear} onValueChange={setFiscalYear}>
          <SelectTrigger>
            <SelectValue placeholder="Not set" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Not set</SelectItem>
            {fiscalYears.map((fy) => (
              <SelectItem key={fy.id} value={fy.id}>
                {fy.name}
                {fy.isClosed ? " (closed)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Auto-posted entries are dated into this fiscal year. Must be open.
        </p>
      </div>

      <Button
        onClick={() =>
          updateMut.mutate({
            defaultInventoryAccountId: toNull(inventory),
            defaultApAccountId: toNull(ap),
            defaultExpenseAccountId: toNull(expense),
            defaultInputVatAccountId: toNull(inputVat),
            defaultFiscalYearId: toNull(fiscalYear),
          })
        }
        disabled={updateMut.isPending}
      >
        {updateMut.isPending ? "Saving…" : "Save Settings"}
      </Button>
    </div>
  );
}
