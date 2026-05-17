"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";

interface PartRow {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  totalPrice: string;
  isFromInventory: boolean;
}

interface ServiceRow {
  id: string;
  description: string;
  hours: string | null;
  rate: string | null;
  amount: string;
}

interface JobOrderLineItemsProps {
  jobOrderId: string;
  parts: PartRow[];
  serviceLines: ServiceRow[];
  canEdit: boolean;
  currency: string;
}

function formatMoney(value: string, currency: string): string {
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(n);
}

export function JobOrderLineItems({
  jobOrderId,
  parts,
  serviceLines,
  canEdit,
  currency,
}: JobOrderLineItemsProps) {
  const router = useRouter();

  const [partDraft, setPartDraft] = useState({
    description: "",
    quantity: "1",
    unitPrice: "0",
    isFromInventory: false,
  });
  const [serviceDraft, setServiceDraft] = useState({
    description: "",
    hours: "",
    rate: "",
    amount: "0",
  });

  const addPart = trpc.jobOrder.addPart.useMutation({
    onSuccess: () => {
      setPartDraft({ description: "", quantity: "1", unitPrice: "0", isFromInventory: false });
      toast.success("Part added.");
      router.refresh();
    },
    onError: (e) => toast.error(e.message),
  });
  const removePart = trpc.jobOrder.removePart.useMutation({
    onSuccess: () => {
      toast.success("Part removed.");
      router.refresh();
    },
    onError: (e) => toast.error(e.message),
  });
  const addService = trpc.jobOrder.addServiceLine.useMutation({
    onSuccess: () => {
      setServiceDraft({ description: "", hours: "", rate: "", amount: "0" });
      toast.success("Service line added.");
      router.refresh();
    },
    onError: (e) => toast.error(e.message),
  });
  const removeService = trpc.jobOrder.removeServiceLine.useMutation({
    onSuccess: () => {
      toast.success("Service line removed.");
      router.refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleAddPart = (): void => {
    const quantity = Number(partDraft.quantity);
    const unitPrice = Number(partDraft.unitPrice);
    if (partDraft.description.trim() === "") {
      toast.error("Description is required.");
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error("Quantity must be greater than zero.");
      return;
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      toast.error("Unit price must be zero or greater.");
      return;
    }
    addPart.mutate({
      jobOrderId,
      description: partDraft.description,
      quantity,
      unitPrice,
      isFromInventory: partDraft.isFromInventory,
    });
  };

  const handleAddService = (): void => {
    const amount = Number(serviceDraft.amount);
    if (serviceDraft.description.trim() === "") {
      toast.error("Description is required.");
      return;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error("Amount must be zero or greater.");
      return;
    }
    const hours = serviceDraft.hours.trim() === "" ? undefined : Number(serviceDraft.hours);
    const rate = serviceDraft.rate.trim() === "" ? undefined : Number(serviceDraft.rate);
    if (hours !== undefined && (!Number.isFinite(hours) || hours < 0)) {
      toast.error("Hours must be zero or greater.");
      return;
    }
    if (rate !== undefined && (!Number.isFinite(rate) || rate < 0)) {
      toast.error("Rate must be zero or greater.");
      return;
    }
    addService.mutate({
      jobOrderId,
      description: serviceDraft.description,
      amount,
      ...(hours !== undefined ? { hours } : {}),
      ...(rate !== undefined ? { rate } : {}),
    });
  };

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">Parts</h2>
        {parts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No parts recorded yet.</p>
        ) : (
          <div className="overflow-hidden rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Unit price</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {parts.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-3 py-2">{p.description}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{p.quantity}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatMoney(p.unitPrice, currency)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatMoney(p.totalPrice, currency)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {canEdit ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => removePart.mutate({ id: p.id })}
                          disabled={removePart.isPending}
                        >
                          Remove
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {canEdit ? (
          <div className="grid gap-2 rounded-md border border-dashed border-border p-3 sm:grid-cols-[2fr_80px_120px_auto]">
            <div className="space-y-1">
              <Label htmlFor="part-description">Description</Label>
              <Input
                id="part-description"
                value={partDraft.description}
                onChange={(e) => setPartDraft((d) => ({ ...d, description: e.target.value }))}
                placeholder="e.g. SSD 500 GB"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="part-quantity">Qty</Label>
              <Input
                id="part-quantity"
                type="number"
                min={0}
                step="0.01"
                value={partDraft.quantity}
                onChange={(e) => setPartDraft((d) => ({ ...d, quantity: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="part-unit-price">Unit price</Label>
              <Input
                id="part-unit-price"
                type="number"
                min={0}
                step="0.01"
                value={partDraft.unitPrice}
                onChange={(e) => setPartDraft((d) => ({ ...d, unitPrice: e.target.value }))}
              />
            </div>
            <div className="flex items-end">
              <Button type="button" onClick={handleAddPart} disabled={addPart.isPending}>
                {addPart.isPending ? "Adding…" : "Add part"}
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">Service lines</h2>
        {serviceLines.length === 0 ? (
          <p className="text-sm text-muted-foreground">No service lines recorded yet.</p>
        ) : (
          <div className="overflow-hidden rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2 text-right">Hours</th>
                  <th className="px-3 py-2 text-right">Rate</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {serviceLines.map((s) => (
                  <tr key={s.id} className="border-t border-border">
                    <td className="px-3 py-2">{s.description}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.hours ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {s.rate === null ? "—" : formatMoney(s.rate, currency)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatMoney(s.amount, currency)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {canEdit ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => removeService.mutate({ id: s.id })}
                          disabled={removeService.isPending}
                        >
                          Remove
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {canEdit ? (
          <div className="grid gap-2 rounded-md border border-dashed border-border p-3 sm:grid-cols-[2fr_80px_100px_120px_auto]">
            <div className="space-y-1">
              <Label htmlFor="svc-description">Description</Label>
              <Input
                id="svc-description"
                value={serviceDraft.description}
                onChange={(e) =>
                  setServiceDraft((d) => ({ ...d, description: e.target.value }))
                }
                placeholder="e.g. Diagnostic labor"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="svc-hours">Hours</Label>
              <Input
                id="svc-hours"
                type="number"
                min={0}
                step="0.25"
                value={serviceDraft.hours}
                onChange={(e) => setServiceDraft((d) => ({ ...d, hours: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="svc-rate">Rate</Label>
              <Input
                id="svc-rate"
                type="number"
                min={0}
                step="0.01"
                value={serviceDraft.rate}
                onChange={(e) => setServiceDraft((d) => ({ ...d, rate: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="svc-amount">Amount</Label>
              <Input
                id="svc-amount"
                type="number"
                min={0}
                step="0.01"
                value={serviceDraft.amount}
                onChange={(e) => setServiceDraft((d) => ({ ...d, amount: e.target.value }))}
              />
            </div>
            <div className="flex items-end">
              <Button type="button" onClick={handleAddService} disabled={addService.isPending}>
                {addService.isPending ? "Adding…" : "Add service"}
              </Button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
