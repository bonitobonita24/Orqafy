"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PayslipFormProps {
  slug: string;
  payrollId: string;
  currency: string;
}

const ZERO = "0";

export function PayslipForm({ slug, payrollId, currency }: PayslipFormProps) {
  const router = useRouter();

  const { data: employeeData } = trpc.employee.list.useQuery({ limit: 200 });
  const employees = employeeData?.items ?? [];

  const [employeeId, setEmployeeId] = useState("");
  const [basicPay, setBasicPay] = useState(ZERO);
  const [overtimePay, setOvertimePay] = useState(ZERO);
  const [allowances, setAllowances] = useState(ZERO);
  const [sssDeduction, setSssDeduction] = useState(ZERO);
  const [philhealthDeduction, setPhilhealthDeduction] = useState(ZERO);
  const [pagibigDeduction, setPagibigDeduction] = useState(ZERO);
  const [taxDeduction, setTaxDeduction] = useState(ZERO);
  const [cashAdvanceDeduction, setCashAdvanceDeduction] = useState(ZERO);
  const [otherDeductions, setOtherDeductions] = useState(ZERO);
  const [error, setError] = useState<string | null>(null);

  const addMut = trpc.payroll.payslip.add.useMutation({
    onSuccess: () => {
      toast.success("Payslip added.");
      router.push(`/${slug}/payroll/${payrollId}`);
      router.refresh();
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  // Form-level preview (mirrors server derivation — no business logic)
  const n = (v: string) => parseFloat(v) || 0;
  const grossPay = n(basicPay) + n(overtimePay) + n(allowances);
  const totalDeductions =
    n(sssDeduction) +
    n(philhealthDeduction) +
    n(pagibigDeduction) +
    n(taxDeduction) +
    n(cashAdvanceDeduction) +
    n(otherDeductions);
  const netPay = grossPay - totalDeductions;

  function fmt(val: number) {
    return `${currency} ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!employeeId) {
      setError("Please select an employee.");
      return;
    }
    addMut.mutate({
      payrollId,
      employeeId,
      basicPay: n(basicPay),
      overtimePay: n(overtimePay),
      allowances: n(allowances),
      sssDeduction: n(sssDeduction),
      philhealthDeduction: n(philhealthDeduction),
      pagibigDeduction: n(pagibigDeduction),
      taxDeduction: n(taxDeduction),
      cashAdvanceDeduction: n(cashAdvanceDeduction),
      otherDeductions: n(otherDeductions),
    });
  }

  function numField(
    id: string,
    label: string,
    value: string,
    setter: (v: string) => void,
    hint?: string,
  ) {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id}>
          {label}
          {hint !== undefined && (
            <span className="ml-1 text-xs font-normal text-muted-foreground">{hint}</span>
          )}
        </Label>
        <Input
          id={id}
          type="number"
          min="0"
          step="0.01"
          value={value}
          onChange={(e) => setter(e.target.value)}
        />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Employee */}
      <div className="space-y-1.5">
        <Label htmlFor="employeeId">Employee</Label>
        <Select value={employeeId} onValueChange={setEmployeeId}>
          <SelectTrigger id="employeeId" className="w-full max-w-sm">
            <SelectValue placeholder="Select employee…" />
          </SelectTrigger>
          <SelectContent>
            {employees.map((emp) => {
              const name =
                emp.user.displayName ??
                `${emp.user.firstName} ${emp.user.lastName}`.trim();
              return (
                <SelectItem key={emp.id} value={emp.id}>
                  {name} — {emp.employeeNumber}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Earnings */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Earnings (manual entry)
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {numField("basicPay", "Basic Pay", basicPay, setBasicPay)}
          {numField("overtimePay", "Overtime Pay", overtimePay, setOvertimePay)}
          {numField("allowances", "Allowances", allowances, setAllowances)}
        </div>
      </section>

      {/* Deductions — HOLD(owner-rule): PH statutory formulas not computed automatically */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Deductions (manual entry)
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {numField("sssDeduction", "SSS", sssDeduction, setSssDeduction, "(HOLD: auto-formula)")}
          {numField("philhealthDeduction", "PhilHealth", philhealthDeduction, setPhilhealthDeduction, "(HOLD: auto-formula)")}
          {numField("pagibigDeduction", "Pag-IBIG", pagibigDeduction, setPagibigDeduction, "(HOLD: auto-formula)")}
          {numField("taxDeduction", "Withholding Tax", taxDeduction, setTaxDeduction, "(HOLD: auto-formula)")}
          {numField("cashAdvanceDeduction", "Cash Advance", cashAdvanceDeduction, setCashAdvanceDeduction)}
          {numField("otherDeductions", "Other Deductions", otherDeductions, setOtherDeductions)}
        </div>
      </section>

      {/* Live preview */}
      <section className="rounded-lg border border-border bg-muted/30 p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Preview (computed from inputs)
        </h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Gross Pay</div>
            <div className="mt-0.5 font-mono font-medium">{fmt(grossPay)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Total Deductions</div>
            <div className="mt-0.5 font-mono font-medium text-red-400">{fmt(totalDeductions)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Net Pay</div>
            <div className="mt-0.5 font-mono font-semibold text-primary">{fmt(netPay)}</div>
          </div>
        </div>
      </section>

      {error !== null && (
        <p className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={addMut.isPending}>
          {addMut.isPending ? "Adding…" : "Add Payslip"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={addMut.isPending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
