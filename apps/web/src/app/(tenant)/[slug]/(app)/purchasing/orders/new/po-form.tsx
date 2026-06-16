"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";
import { trpc } from "@/lib/trpc";
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

interface VendorOption {
  id: string;
  companyName: string;
}

interface LineItem {
  description: string;
  quantity: string;
  unitPrice: string;
}

function newLineItem(): LineItem {
  return { description: "", quantity: "1", unitPrice: "0" };
}

function lineTotal(item: LineItem): number {
  const qty = parseFloat(item.quantity);
  const price = parseFloat(item.unitPrice);
  if (Number.isNaN(qty) || Number.isNaN(price)) return 0;
  return qty * price;
}

interface PoFormProps {
  slug: string;
  vendors: VendorOption[];
  /** When set, form is in edit mode for an existing draft PO */
  poId?: string;
  initial?: {
    vendorId?: string;
    currency?: string;
    notes?: string | undefined;
    expectedDelivery?: string | undefined;
    items?: LineItem[];
  };
}

export function PoForm({ slug, vendors, poId, initial = {} }: PoFormProps) {
  const router = useRouter();
  const isEdit = poId !== undefined;

  const [vendorId, setVendorId] = useState(initial.vendorId ?? "");
  const [currency, setCurrency] = useState(initial.currency ?? "PHP");
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [expectedDelivery, setExpectedDelivery] = useState(initial.expectedDelivery ?? "");
  const [items, setItems] = useState<LineItem[]>(
    initial.items !== undefined && initial.items.length > 0 ? initial.items : [newLineItem()],
  );
  const [error, setError] = useState<string | null>(null);

  const createMut = trpc.purchasing.po.create.useMutation({
    onSuccess: (data) => {
      if (!data) return;
      toast.success(`Purchase order ${data.poNumber} created.`);
      router.push(`/${slug}/purchasing/orders/${data.id}`);
    },
    onError: (err) => {
      setError(err.message);
      toast.error(err.message);
    },
  });

  const updateMut = trpc.purchasing.po.update.useMutation({
    onSuccess: (data: { id: string; poNumber: string }) => {
      toast.success(`Purchase order ${data.poNumber} updated.`);
      router.push(`/${slug}/purchasing/orders/${data.id}`);
      router.refresh();
    },
    onError: (err) => {
      setError(err.message);
      toast.error(err.message);
    },
  });

  const isPending = createMut.isPending || updateMut.isPending;

  function updateItem(idx: number, field: keyof LineItem, value: string) {
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  }

  function addItem() {
    setItems((prev) => [...prev, newLineItem()]);
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  const subtotal = items.reduce((sum, item) => sum + lineTotal(item), 0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (vendorId.trim() === "") {
      setError("Please select a vendor.");
      return;
    }
    if (items.length === 0) {
      setError("At least one line item is required.");
      return;
    }
    for (const item of items) {
      if (item.description.trim() === "") {
        setError("All line items must have a description.");
        return;
      }
      const qty = parseFloat(item.quantity);
      const price = parseFloat(item.unitPrice);
      if (Number.isNaN(qty) || qty <= 0) {
        setError("All quantities must be positive numbers.");
        return;
      }
      if (Number.isNaN(price) || price < 0) {
        setError("All unit prices must be zero or greater.");
        return;
      }
    }

    const payload = {
      vendorId,
      currency,
      ...(notes.trim() !== "" ? { notes: notes.trim() } : {}),
      ...(expectedDelivery.trim() !== ""
        ? { expectedDelivery: new Date(expectedDelivery).toISOString() }
        : {}),
      items: items.map((item) => ({
        description: item.description.trim(),
        quantity: parseFloat(item.quantity),
        unitPrice: parseFloat(item.unitPrice),
        // HOLD(owner-rule): allocation routing (stock/project_expense/company_expense) —
        // owner must decide default allocation type and per-line overrides.
        // For now, default to company_expense so PO can be saved as a valid draft.
        allocations: [
          {
            type: "company_expense" as const,
            quantity: parseFloat(item.quantity),
          },
        ],
      })),
    };

    if (isEdit && poId !== undefined) {
      // HOLD(owner-rule): po.update only supports header fields (vendorId, currency, notes,
      // expectedDelivery). Full line-item replacement on a draft PO requires a dedicated
      // replaceItems procedure — owner must decide if line edits should be allowed and
      // what happens to existing allocation records. For now, only header is updated.
      updateMut.mutate({
        id: poId,
        vendorId: payload.vendorId,
        currency: payload.currency,
        notes: payload.notes,
        expectedDelivery: payload.expectedDelivery,
      });
    } else {
      createMut.mutate(payload);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error !== null && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Header fields */}
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="vendorId">
            Vendor <span className="text-red-400">*</span>
          </Label>
          <Select value={vendorId} onValueChange={setVendorId}>
            <SelectTrigger id="vendorId">
              <SelectValue placeholder="Select a vendor…" />
            </SelectTrigger>
            <SelectContent>
              {vendors.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.companyName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="currency">Currency</Label>
          <Input
            id="currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 3))}
            placeholder="PHP"
            maxLength={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="expectedDelivery">Expected Delivery</Label>
          <Input
            id="expectedDelivery"
            type="date"
            value={expectedDelivery}
            onChange={(e) => setExpectedDelivery(e.target.value)}
          />
        </div>
      </div>

      {/* Line items */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Line Items</h2>
          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            <Plus className="mr-1 h-3 w-3" />
            Add Item
          </Button>
        </div>

        <div className="rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Description</th>
                <th className="w-24 px-3 py-2 font-medium text-right">Qty</th>
                <th className="w-32 px-3 py-2 font-medium text-right">Unit Price</th>
                <th className="w-32 px-3 py-2 font-medium text-right">Total</th>
                <th className="w-10 px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">
                    <Input
                      value={item.description}
                      onChange={(e) => updateItem(idx, "description", e.target.value)}
                      placeholder="Item description"
                      className="h-8 text-sm"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min="0.001"
                      step="any"
                      value={item.quantity}
                      onChange={(e) => updateItem(idx, "quantity", e.target.value)}
                      className="h-8 text-right text-sm"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={item.unitPrice}
                      onChange={(e) => updateItem(idx, "unitPrice", e.target.value)}
                      className="h-8 text-right text-sm"
                    />
                  </td>
                  <td className="px-3 py-2 text-right font-medium">
                    {lineTotal(item).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="text-muted-foreground hover:text-red-400"
                        aria-label="Remove item"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border">
                <td colSpan={3} className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">
                  Subtotal
                </td>
                <td className="px-3 py-2 text-right font-semibold">
                  {subtotal.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                </td>
                <td />
              </tr>
              {/* HOLD(owner-rule): tax calculation — owner must decide tax type (VAT inclusive/exclusive),
                  rate per item category, and whether to apply automatically or enter manually. */}
            </tfoot>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          {/* HOLD(owner-rule): allocation — items default to company_expense until owner defines
              stock/project allocation rules. */}
          Note: line items will be recorded as company expenses by default. Allocation rules (stock, project)
          will be configurable once the owner defines them.
        </p>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Internal notes for this purchase order…"
          rows={3}
        />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending
            ? "Saving…"
            : isEdit
              ? "Update Purchase Order"
              : "Create Draft PO"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/${slug}/purchasing`)}
          disabled={isPending}
        >
          Cancel
        </Button>
        {/* HOLD(owner-rule): submit / approve / mark-ordered actions.
            These transitions need owner sign-off on approval flow, authority levels,
            and whether a submitted PO can still be edited. */}
      </div>
    </form>
  );
}
