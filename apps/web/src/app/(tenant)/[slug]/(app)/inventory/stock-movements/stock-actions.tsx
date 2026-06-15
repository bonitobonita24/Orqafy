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

interface Product {
  id: string;
  name: string;
  unit: string;
}

interface Warehouse {
  id: string;
  name: string;
  code: string;
}

interface StockActionsProps {
  products: Product[];
  warehouses: Warehouse[];
}

type MovementType = "in" | "out" | "adjustment" | "transfer";

// ── Record Movement Dialog ───────────────────────────────────────────────────

function RecordMovementDialog({
  products,
  warehouses,
}: {
  products: Product[];
  warehouses: Warehouse[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<MovementType>("in");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [fromWarehouseId, setFromWarehouseId] = useState("");
  const [toWarehouseId, setToWarehouseId] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setType("in");
    setProductId("");
    setQuantity("");
    setFromWarehouseId("");
    setToWarehouseId("");
    setNotes("");
    setError(null);
  }

  const create = trpc.inventory.stockMovementCreate.useMutation({
    onSuccess: () => {
      toast.success("Stock movement recorded.");
      router.refresh();
      reset();
      setOpen(false);
    },
    onError: (err) => {
      setError(err.message);
      toast.error(err.message);
    },
  });

  const needsFrom = type === "out" || type === "transfer";
  const needsTo = type === "in" || type === "transfer";

  function validate(): string | null {
    if (productId === "") return "Select a product.";
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) return "Quantity must be > 0.";
    if (type === "in" && toWarehouseId === "")
      return "Select a destination warehouse.";
    if (type === "out" && fromWarehouseId === "")
      return "Select a source warehouse.";
    if (type === "transfer") {
      if (fromWarehouseId === "") return "Select a source warehouse.";
      if (toWarehouseId === "") return "Select a destination warehouse.";
      if (fromWarehouseId === toWarehouseId)
        return "Source and destination warehouses must differ.";
    }
    if (
      type === "adjustment" &&
      fromWarehouseId === "" &&
      toWarehouseId === ""
    )
      return "Select at least one warehouse for an adjustment.";
    return null;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const validationError = validate();
    if (validationError !== null) {
      setError(validationError);
      return;
    }
    create.mutate({
      type,
      productId,
      quantity: parseFloat(quantity),
      fromWarehouseId: fromWarehouseId !== "" ? fromWarehouseId : undefined,
      toWarehouseId: toWarehouseId !== "" ? toWarehouseId : undefined,
      notes: notes.trim() !== "" ? notes.trim() : undefined,
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/30"
        >
          Record Movement
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Stock Movement</DialogTitle>
          <DialogDescription>
            Record an inbound, outbound, adjustment, or transfer movement.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error !== null && (
            <p className="rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-400">
              {error}
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="mov-type">Type</Label>
            <Select
              value={type}
              onValueChange={(v) => {
                setType(v as MovementType);
                setFromWarehouseId("");
                setToWarehouseId("");
              }}
              disabled={create.isPending}
            >
              <SelectTrigger id="mov-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in">In (receive stock)</SelectItem>
                <SelectItem value="out">Out (issue stock)</SelectItem>
                <SelectItem value="adjustment">Adjustment</SelectItem>
                <SelectItem value="transfer">Transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mov-product">Product</Label>
            <Select
              value={productId}
              onValueChange={setProductId}
              disabled={create.isPending}
            >
              <SelectTrigger id="mov-product">
                <SelectValue placeholder="Select product" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mov-qty">Quantity</Label>
            <Input
              id="mov-qty"
              type="number"
              min="0.0001"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="e.g. 10"
              disabled={create.isPending}
            />
          </div>
          {(needsFrom || type === "adjustment") && (
            <div className="space-y-1.5">
              <Label htmlFor="mov-from">
                From Warehouse{needsFrom ? " *" : ""}
              </Label>
              <Select
                value={fromWarehouseId}
                onValueChange={(v) =>
                  setFromWarehouseId(v === "__none__" ? "" : v)
                }
                disabled={create.isPending}
              >
                <SelectTrigger id="mov-from">
                  <SelectValue placeholder="Select warehouse" />
                </SelectTrigger>
                <SelectContent>
                  {!needsFrom && (
                    <SelectItem value="__none__">— None —</SelectItem>
                  )}
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {(needsTo || type === "adjustment") && (
            <div className="space-y-1.5">
              <Label htmlFor="mov-to">
                To Warehouse{needsTo ? " *" : ""}
              </Label>
              <Select
                value={toWarehouseId}
                onValueChange={(v) =>
                  setToWarehouseId(v === "__none__" ? "" : v)
                }
                disabled={create.isPending}
              >
                <SelectTrigger id="mov-to">
                  <SelectValue placeholder="Select warehouse" />
                </SelectTrigger>
                <SelectContent>
                  {!needsTo && (
                    <SelectItem value="__none__">— None —</SelectItem>
                  )}
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="mov-notes">Notes</Label>
            <Textarea
              id="mov-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              disabled={create.isPending}
            />
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                reset();
              }}
              disabled={create.isPending}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={create.isPending}
              className="rounded-md border border-primary bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {create.isPending ? "Recording…" : "Record"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Transfer Dialog ──────────────────────────────────────────────────────────

function TransferDialog({
  products,
  warehouses,
}: {
  products: Product[];
  warehouses: Warehouse[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [fromWarehouseId, setFromWarehouseId] = useState("");
  const [toWarehouseId, setToWarehouseId] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setProductId("");
    setQuantity("");
    setFromWarehouseId("");
    setToWarehouseId("");
    setNotes("");
    setError(null);
  }

  const transfer = trpc.inventory.stockTransfer.useMutation({
    onSuccess: () => {
      toast.success("Stock transferred.");
      router.refresh();
      reset();
      setOpen(false);
    },
    onError: (err) => {
      setError(err.message);
      toast.error(err.message);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (productId === "") {
      setError("Select a product.");
      return;
    }
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      setError("Quantity must be > 0.");
      return;
    }
    if (fromWarehouseId === "") {
      setError("Select a source warehouse.");
      return;
    }
    if (toWarehouseId === "") {
      setError("Select a destination warehouse.");
      return;
    }
    if (fromWarehouseId === toWarehouseId) {
      setError("Source and destination warehouses must differ.");
      return;
    }
    transfer.mutate({
      productId,
      quantity: qty,
      fromWarehouseId,
      toWarehouseId,
      notes: notes.trim() !== "" ? notes.trim() : undefined,
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="rounded-md border border-sky-400/30 bg-sky-400/10 px-3 py-2 text-sm font-medium text-sky-400 transition-colors hover:bg-sky-400/20"
        >
          Transfer Stock
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transfer Stock</DialogTitle>
          <DialogDescription>
            Move stock from one warehouse to another. Source and destination must
            differ.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error !== null && (
            <p className="rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-400">
              {error}
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="tr-product">Product *</Label>
            <Select
              value={productId}
              onValueChange={setProductId}
              disabled={transfer.isPending}
            >
              <SelectTrigger id="tr-product">
                <SelectValue placeholder="Select product" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tr-qty">Quantity *</Label>
            <Input
              id="tr-qty"
              type="number"
              min="0.0001"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="e.g. 5"
              disabled={transfer.isPending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tr-from">From Warehouse *</Label>
            <Select
              value={fromWarehouseId}
              onValueChange={setFromWarehouseId}
              disabled={transfer.isPending}
            >
              <SelectTrigger id="tr-from">
                <SelectValue placeholder="Select warehouse" />
              </SelectTrigger>
              <SelectContent>
                {warehouses.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name} ({w.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tr-to">To Warehouse *</Label>
            <Select
              value={toWarehouseId}
              onValueChange={setToWarehouseId}
              disabled={transfer.isPending}
            >
              <SelectTrigger id="tr-to">
                <SelectValue placeholder="Select warehouse" />
              </SelectTrigger>
              <SelectContent>
                {warehouses.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name} ({w.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tr-notes">Notes</Label>
            <Textarea
              id="tr-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              disabled={transfer.isPending}
            />
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                reset();
              }}
              disabled={transfer.isPending}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={transfer.isPending}
              className="rounded-md border border-sky-400/30 bg-sky-400/10 px-3 py-1.5 text-sm font-medium text-sky-400 hover:bg-sky-400/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {transfer.isPending ? "Transferring…" : "Transfer"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Adjust Dialog ────────────────────────────────────────────────────────────

function AdjustDialog({
  products,
  warehouses,
}: {
  products: Product[];
  warehouses: Warehouse[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setProductId("");
    setQuantity("");
    setWarehouseId("");
    setNotes("");
    setConfirmOpen(false);
    setError(null);
  }

  const adjust = trpc.inventory.stockAdjustment.useMutation({
    onSuccess: () => {
      toast.success("Stock adjusted.");
      router.refresh();
      reset();
      setOpen(false);
    },
    onError: (err) => {
      setError(err.message);
      setConfirmOpen(false);
      toast.error(err.message);
    },
  });

  function handlePreSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (productId === "") {
      setError("Select a product.");
      return;
    }
    const qty = parseFloat(quantity);
    if (isNaN(qty)) {
      setError("Quantity must be a number.");
      return;
    }
    if (warehouseId === "") {
      setError("Select a warehouse.");
      return;
    }
    if (notes.trim() === "") {
      setError("Reason / notes are required for adjustments.");
      return;
    }
    setConfirmOpen(true);
  }

  function handleConfirm() {
    adjust.mutate({
      productId,
      quantity: parseFloat(quantity),
      warehouseId,
      notes: notes.trim(),
    });
  }

  const selectedProduct = products.find((p) => p.id === productId);
  const qtyNum = parseFloat(quantity);
  const isNegative = !isNaN(qtyNum) && qtyNum < 0;

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) reset();
        }}
      >
        <DialogTrigger asChild>
          <button
            type="button"
            className="rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm font-medium text-amber-400 transition-colors hover:bg-amber-400/20"
          >
            Adjust Stock
          </button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Stock</DialogTitle>
            <DialogDescription>
              Positive quantity adds stock; negative removes it. A reason is
              required.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePreSubmit} className="space-y-4 pt-2">
            {error !== null && (
              <p className="rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-400">
                {error}
              </p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="adj-product">Product *</Label>
              <Select
                value={productId}
                onValueChange={setProductId}
                disabled={adjust.isPending}
              >
                <SelectTrigger id="adj-product">
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adj-qty">Quantity *</Label>
              <Input
                id="adj-qty"
                type="number"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="e.g. 10 or -3"
                disabled={adjust.isPending}
              />
              <p className="text-xs text-muted-foreground">
                Positive = add stock · Negative = remove stock
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adj-warehouse">Warehouse *</Label>
              <Select
                value={warehouseId}
                onValueChange={setWarehouseId}
                disabled={adjust.isPending}
              >
                <SelectTrigger id="adj-warehouse">
                  <SelectValue placeholder="Select warehouse" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adj-notes">Reason / Notes *</Label>
              <Textarea
                id="adj-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="e.g. Physical count discrepancy"
                disabled={adjust.isPending}
              />
            </div>
            <DialogFooter>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
                disabled={adjust.isPending}
                className="rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={adjust.isPending}
                className="rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-sm font-medium text-amber-400 hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Review Adjustment
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Stock Adjustment</DialogTitle>
            <DialogDescription>
              This will{" "}
              <strong>{isNegative ? "remove" : "add"}</strong>{" "}
              <strong>
                {Math.abs(qtyNum || 0)}{" "}
                {selectedProduct !== undefined ? selectedProduct.unit : "units"}
              </strong>{" "}
              {isNegative ? "from" : "to"} the selected warehouse. Reason:{" "}
              <em>{notes}</em>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              disabled={adjust.isPending}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
            >
              Go Back
            </button>
            <button
              type="button"
              disabled={adjust.isPending}
              onClick={handleConfirm}
              className="rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-sm font-medium text-amber-400 hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {adjust.isPending ? "Adjusting…" : "Confirm Adjustment"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Main Export ──────────────────────────────────────────────────────────────

export function StockActions({ products, warehouses }: StockActionsProps) {
  return (
    <div className="flex items-center gap-2">
      <RecordMovementDialog products={products} warehouses={warehouses} />
      <TransferDialog products={products} warehouses={warehouses} />
      <AdjustDialog products={products} warehouses={warehouses} />
    </div>
  );
}
