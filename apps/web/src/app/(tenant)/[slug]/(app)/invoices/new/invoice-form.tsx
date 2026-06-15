"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CustomerOption {
  id: string;
  firstName: string;
  lastName: string;
  companyName: string | null;
}

interface ProjectOption {
  id: string;
  name: string;
}

interface InvoiceFormProps {
  slug: string;
  customers: CustomerOption[];
  projects: ProjectOption[];
}

interface LineItemDraft {
  description: string;
  quantity: string;
  unitPrice: string;
}

const NO_PROJECT = "__none__";

function customerLabel(c: CustomerOption): string {
  const company = c.companyName?.trim();
  if (company !== undefined && company.length > 0) return company;
  return `${c.firstName} ${c.lastName}`.trim();
}

function emptyLine(): LineItemDraft {
  return { description: "", quantity: "1", unitPrice: "0" };
}

function formatCurrency(num: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(num);
}

export function InvoiceForm({ slug, customers, projects }: InvoiceFormProps) {
  const router = useRouter();

  const [customerId, setCustomerId] = useState<string>("");
  const [projectId, setProjectId] = useState<string>(NO_PROJECT);
  const [dueDate, setDueDate] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [lineItems, setLineItems] = useState<LineItemDraft[]>([emptyLine()]);
  const [error, setError] = useState<string | null>(null);

  const subtotal = useMemo(
    () =>
      lineItems.reduce((sum, li) => {
        const q = Number(li.quantity);
        const p = Number(li.unitPrice);
        if (!Number.isFinite(q) || !Number.isFinite(p)) return sum;
        return sum + q * p;
      }, 0),
    [lineItems],
  );

  const createMutation = trpc.invoice.create.useMutation({
    onSuccess: (created) => {
      toast.success("Invoice created.");
      router.push(`/${slug}/invoices/${created.id}`);
      router.refresh();
    },
    onError: (err) => {
      setError(err.message);
      toast.error("Failed to create invoice.");
    },
  });

  const isPending = createMutation.isPending;

  function updateLine(index: number, field: keyof LineItemDraft, value: string) {
    setLineItems((prev) => prev.map((li, i) => (i === index ? { ...li, [field]: value } : li)));
  }

  function addLine() {
    setLineItems((prev) => [...prev, emptyLine()]);
  }

  function removeLine(index: number) {
    setLineItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  function submit() {
    setError(null);

    if (customerId.trim().length === 0) {
      setError("Customer is required.");
      return;
    }
    if (dueDate.trim().length === 0) {
      setError("Due date is required.");
      return;
    }

    const parsedItems: { description: string; quantity: number; unitPrice: number }[] = [];
    for (let i = 0; i < lineItems.length; i++) {
      const li = lineItems[i];
      if (li === undefined) continue;
      const description = li.description.trim();
      const quantity = Number(li.quantity);
      const unitPrice = Number(li.unitPrice);
      if (description.length === 0) {
        setError(`Line ${i + 1}: description is required.`);
        return;
      }
      if (!Number.isFinite(quantity) || quantity <= 0) {
        setError(`Line ${i + 1}: quantity must be greater than 0.`);
        return;
      }
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        setError(`Line ${i + 1}: unit price must be 0 or greater.`);
        return;
      }
      parsedItems.push({ description, quantity, unitPrice });
    }

    if (parsedItems.length === 0) {
      setError("At least one line item is required.");
      return;
    }

    createMutation.mutate({
      customerId,
      ...(projectId !== NO_PROJECT ? { projectId } : {}),
      dueDate: new Date(dueDate),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      lineItems: parsedItems,
    });
  }

  const inputCls =
    "w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {error !== null && (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Details
        </h2>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Customer <span className="text-red-400">*</span>
          </label>
          <Select value={customerId} onValueChange={setCustomerId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a customer" />
            </SelectTrigger>
            <SelectContent>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {customerLabel(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Project</label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="No project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PROJECT}>No project</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Due Date <span className="text-red-400">*</span>
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Line Items
          </h2>
          <button
            type="button"
            onClick={addLine}
            className="rounded-md border border-border bg-background px-3 py-1 text-xs font-medium text-foreground hover:bg-muted"
          >
            + Add line
          </button>
        </div>

        <div className="space-y-3">
          {lineItems.map((li, i) => (
            <div key={i} className="grid grid-cols-12 gap-2">
              <div className="col-span-6">
                <input
                  type="text"
                  value={li.description}
                  onChange={(e) => updateLine(i, "description", e.target.value)}
                  className={inputCls}
                  maxLength={500}
                  placeholder="Description"
                />
              </div>
              <div className="col-span-2">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={li.quantity}
                  onChange={(e) => updateLine(i, "quantity", e.target.value)}
                  className={inputCls}
                  placeholder="Qty"
                />
              </div>
              <div className="col-span-3">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={li.unitPrice}
                  onChange={(e) => updateLine(i, "unitPrice", e.target.value)}
                  className={inputCls}
                  placeholder="Unit price"
                />
              </div>
              <div className="col-span-1 flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => removeLine(i)}
                  disabled={lineItems.length <= 1}
                  className="text-muted-foreground hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label="Remove line"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end border-t border-border pt-3 text-sm">
          <span className="text-muted-foreground">Subtotal:&nbsp;</span>
          <span className="font-semibold text-foreground">{formatCurrency(subtotal)}</span>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Notes
        </h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className={inputCls}
          maxLength={1000}
          placeholder="Optional notes shown on the invoice…"
        />
      </div>

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={submit}
          className="rounded-md border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Create Invoice"}
        </button>
      </div>
    </div>
  );
}
