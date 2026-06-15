"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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

interface PoItem {
  id: string;
  description: string;
  quantity: number | string;
  quantityReceived: number | string;
  product: { id: string; name: string; sku: string } | null;
}

interface PoOption {
  id: string;
  poNumber: string;
  vendor: { companyName: string };
  items: PoItem[];
}

interface GrLineItem {
  poItemId: string;
  description: string;
  productId: string | null;
  quantityExpected: string;
  quantityReceived: string;
  quantityRejected: string;
  notes: string;
}

interface GrFormProps {
  slug: string;
  receivablePos: PoOption[];
}

export function GrForm({ slug, receivablePos }: GrFormProps) {
  const router = useRouter();

  const [selectedPoId, setSelectedPoId] = useState<string>("");
  const [grNotes, setGrNotes] = useState("");
  const [grLines, setGrLines] = useState<GrLineItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const selectedPo = receivablePos.find((po) => po.id === selectedPoId);

  function handlePoSelect(poId: string) {
    setSelectedPoId(poId);
    const po = receivablePos.find((p) => p.id === poId);
    if (po === undefined) {
      setGrLines([]);
      return;
    }
    // Pre-populate lines from the PO items
    setGrLines(
      po.items.map((item) => {
        const remaining = Math.max(
          0,
          Number(item.quantity) - Number(item.quantityReceived),
        );
        return {
          poItemId: item.id,
          description: item.description,
          productId: item.product?.id ?? null,
          quantityExpected: String(remaining),
          quantityReceived: String(remaining),
          quantityRejected: "0",
          notes: "",
        };
      }),
    );
  }

  function updateLine(idx: number, field: keyof GrLineItem, value: string) {
    setGrLines((prev) => prev.map((line, i) => (i === idx ? { ...line, [field]: value } : line)));
  }

  const createMut = trpc.purchasing.goodsReceipt.create.useMutation({
    onSuccess: (data) => {
      toast.success(`Goods receipt ${data?.grNumber ?? ""} recorded.`);
      router.push(`/${slug}/purchasing/receipts`);
      router.refresh();
    },
    onError: (err) => {
      setError(err.message);
      toast.error(err.message);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (selectedPoId.trim() === "") {
      setError("Please select a Purchase Order.");
      return;
    }
    if (grLines.length === 0) {
      setError("No line items found for the selected PO.");
      return;
    }
    for (const line of grLines) {
      const received = parseFloat(line.quantityReceived);
      const expected = parseFloat(line.quantityExpected);
      const rejected = parseFloat(line.quantityRejected);
      if (Number.isNaN(received) || received < 0) {
        setError(`"${line.description}": quantity received must be 0 or greater.`);
        return;
      }
      if (Number.isNaN(rejected) || rejected < 0) {
        setError(`"${line.description}": quantity rejected must be 0 or greater.`);
        return;
      }
      if (received + rejected > expected * 2) {
        // Loose guard — owner may allow over-receipt; exact rules HOLD for owner decision
        setError(`"${line.description}": combined received + rejected seems unusually high.`);
        return;
      }
    }

    createMut.mutate({
      purchaseOrderId: selectedPoId,
      ...(grNotes.trim() !== "" ? { notes: grNotes.trim() } : {}),
      items: grLines.map((line) => ({
        ...(line.productId !== null ? { productId: line.productId } : {}),
        description: line.description,
        quantityExpected: parseFloat(line.quantityExpected),
        quantityReceived: parseFloat(line.quantityReceived),
        quantityRejected: parseFloat(line.quantityRejected),
        ...(line.notes.trim() !== "" ? { notes: line.notes.trim() } : {}),
      })),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error !== null && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* PO Selection */}
      <div className="space-y-2">
        <Label htmlFor="poId">
          Purchase Order <span className="text-red-400">*</span>
        </Label>
        <Select value={selectedPoId} onValueChange={handlePoSelect}>
          <SelectTrigger id="poId" className="w-full max-w-md">
            <SelectValue placeholder="Select a Purchase Order…" />
          </SelectTrigger>
          <SelectContent>
            {receivablePos.map((po) => (
              <SelectItem key={po.id} value={po.id}>
                {po.poNumber} — {po.vendor.companyName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Line items (shown once a PO is selected) */}
      {grLines.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold">Items Received</h2>
          <div className="rounded-lg border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Description</th>
                  <th className="w-28 px-3 py-2 font-medium text-right">Expected</th>
                  <th className="w-28 px-3 py-2 font-medium text-right">Received</th>
                  <th className="w-28 px-3 py-2 font-medium text-right">Rejected</th>
                  <th className="px-3 py-2 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {grLines.map((line, idx) => (
                  <tr key={idx} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">
                      <p className="font-medium">{line.description}</p>
                      {line.productId !== null && (
                        <p className="text-xs text-muted-foreground">
                          {selectedPo?.items.find((i) => i.id === line.poItemId)?.product?.sku ?? ""}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground">
                      {line.quantityExpected}
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={line.quantityReceived}
                        onChange={(e) => updateLine(idx, "quantityReceived", e.target.value)}
                        className="h-8 text-right text-sm"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={line.quantityRejected}
                        onChange={(e) => updateLine(idx, "quantityRejected", e.target.value)}
                        className="h-8 text-right text-sm"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        value={line.notes}
                        onChange={(e) => updateLine(idx, "notes", e.target.value)}
                        placeholder="Optional note…"
                        className="h-8 text-sm"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            {/* HOLD(owner-rule): over-receipt — should receiving more than ordered be allowed?
                Currently blocked at router level (status guard). Owner must decide. */}
            {/* HOLD(owner-rule): auto-posting to inventory stock — router does create StockMovements
                for stock-allocated items, but allocation rules need owner confirmation before enabling. */}
            Receiving items here records the quantities only. Inventory stock updates follow
            the allocation rules defined on the Purchase Order.
          </p>
        </div>
      )}

      {/* Receipt-level notes */}
      <div className="space-y-2">
        <Label htmlFor="grNotes">Notes</Label>
        <Textarea
          id="grNotes"
          value={grNotes}
          onChange={(e) => setGrNotes(e.target.value)}
          placeholder="Delivery notes, condition notes…"
          rows={2}
        />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={createMut.isPending || selectedPoId === ""}>
          {createMut.isPending ? "Saving…" : "Record Goods Receipt"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/${slug}/purchasing/receipts`)}
          disabled={createMut.isPending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
