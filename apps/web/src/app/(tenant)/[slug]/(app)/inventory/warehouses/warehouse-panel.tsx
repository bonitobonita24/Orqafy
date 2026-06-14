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

interface Warehouse {
  id: string;
  name: string;
  code: string;
  address: string | null;
  isDefault: boolean;
  isActive: boolean;
}

interface WarehousePanelProps {
  warehouses: Warehouse[];
}

// ── Add Dialog ──────────────────────────────────────────────────────────────

function AddWarehouseDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setCode("");
    setAddress("");
    setIsDefault(false);
    setError(null);
  }

  const create = trpc.inventory.warehouseCreate.useMutation({
    onSuccess: () => {
      toast.success("Warehouse created.");
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
    if (name.trim() === "") {
      setError("Name is required.");
      return;
    }
    if (code.trim() === "") {
      setError("Code is required.");
      return;
    }
    create.mutate({
      name: name.trim(),
      code: code.trim(),
      address: address.trim() !== "" ? address.trim() : undefined,
      isDefault,
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
          className="rounded-md border border-[#00d992] bg-[#00d992]/10 px-3 py-2 text-sm font-medium text-[#00d992] hover:bg-[#00d992]/20"
        >
          + Add Warehouse
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Warehouse</DialogTitle>
          <DialogDescription>
            Add a physical warehouse or storage location.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error !== null && (
            <p className="rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-400">
              {error}
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="wh-name">Name *</Label>
            <Input
              id="wh-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Main Warehouse"
              disabled={create.isPending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wh-code">Code *</Label>
            <Input
              id="wh-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. WH-MAIN"
              disabled={create.isPending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wh-address">Address</Label>
            <Textarea
              id="wh-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
              placeholder="Optional address"
              disabled={create.isPending}
            />
          </div>
          <div className="flex items-center gap-3">
            <input
              id="wh-default"
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              disabled={create.isPending}
              className="h-4 w-4 rounded border-border accent-[#00d992]"
            />
            <Label htmlFor="wh-default" className="cursor-pointer">
              Set as default warehouse
            </Label>
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
              className="rounded-md border border-[#00d992] bg-[#00d992]/10 px-3 py-1.5 text-sm font-medium text-[#00d992] hover:bg-[#00d992]/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {create.isPending ? "Creating…" : "Create"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Edit Dialog ─────────────────────────────────────────────────────────────

function EditWarehouseDialog({ warehouse }: { warehouse: Warehouse }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(warehouse.name);
  const [code, setCode] = useState(warehouse.code);
  const [address, setAddress] = useState(warehouse.address ?? "");
  const [isDefault, setIsDefault] = useState(warehouse.isDefault);
  const [isActive, setIsActive] = useState(warehouse.isActive);
  const [error, setError] = useState<string | null>(null);

  function resetToWarehouse() {
    setName(warehouse.name);
    setCode(warehouse.code);
    setAddress(warehouse.address ?? "");
    setIsDefault(warehouse.isDefault);
    setIsActive(warehouse.isActive);
    setError(null);
  }

  const update = trpc.inventory.warehouseUpdate.useMutation({
    onSuccess: () => {
      toast.success("Warehouse updated.");
      router.refresh();
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
    update.mutate({
      id: warehouse.id,
      name: name.trim() !== "" ? name.trim() : undefined,
      code: code.trim() !== "" ? code.trim() : undefined,
      address: address.trim() !== "" ? address.trim() : undefined,
      isDefault,
      isActive,
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetToWarehouse();
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="text-xs text-muted-foreground transition-colors hover:text-[#00d992]"
        >
          Edit
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Warehouse</DialogTitle>
          <DialogDescription>{warehouse.name}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error !== null && (
            <p className="rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-400">
              {error}
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor={`edit-wh-name-${warehouse.id}`}>Name</Label>
            <Input
              id={`edit-wh-name-${warehouse.id}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={update.isPending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`edit-wh-code-${warehouse.id}`}>Code</Label>
            <Input
              id={`edit-wh-code-${warehouse.id}`}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={update.isPending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`edit-wh-addr-${warehouse.id}`}>Address</Label>
            <Textarea
              id={`edit-wh-addr-${warehouse.id}`}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
              disabled={update.isPending}
            />
          </div>
          <div className="flex items-center gap-3">
            <input
              id={`edit-wh-default-${warehouse.id}`}
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              disabled={update.isPending}
              className="h-4 w-4 rounded border-border accent-[#00d992]"
            />
            <Label
              htmlFor={`edit-wh-default-${warehouse.id}`}
              className="cursor-pointer"
            >
              Default warehouse
            </Label>
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                resetToWarehouse();
              }}
              disabled={update.isPending}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={update.isPending}
              className="rounded-md border border-[#00d992] bg-[#00d992]/10 px-3 py-1.5 text-sm font-medium text-[#00d992] hover:bg-[#00d992]/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {update.isPending ? "Saving…" : "Save"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Toggle ───────────────────────────────────────────────────────────────────

function WarehouseToggle({ warehouse }: { warehouse: Warehouse }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const toggle = trpc.inventory.warehouseToggleActive.useMutation({
    onSuccess: () => {
      toast.success(
        warehouse.isActive ? "Warehouse deactivated." : "Warehouse activated.",
      );
      setOpen(false);
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={`rounded-full border px-2 py-0.5 text-xs font-medium transition-colors hover:opacity-80 ${
            warehouse.isActive
              ? "border-[#00d992]/30 bg-[#00d992]/10 text-[#00d992]"
              : "border-border bg-muted text-muted-foreground"
          }`}
        >
          {warehouse.isActive ? "Active" : "Inactive"}
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {warehouse.isActive ? "Deactivate" : "Activate"} Warehouse
          </DialogTitle>
          <DialogDescription>
            {warehouse.isActive
              ? `Deactivating "${warehouse.name}" will prevent new stock movements to/from it.`
              : `Activating "${warehouse.name}" will make it available for stock movements.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={toggle.isPending}
            className="rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={toggle.isPending}
            onClick={() => toggle.mutate({ id: warehouse.id })}
            className={`rounded-md border px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
              warehouse.isActive
                ? "border-red-400/30 bg-red-400/10 text-red-400 hover:bg-red-400/20"
                : "border-[#00d992]/30 bg-[#00d992]/10 text-[#00d992] hover:bg-[#00d992]/20"
            }`}
          >
            {toggle.isPending
              ? "Saving…"
              : warehouse.isActive
                ? "Deactivate"
                : "Activate"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Panel ───────────────────────────────────────────────────────────────

export function WarehousePanel({ warehouses }: WarehousePanelProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {warehouses.filter((w) => w.isActive).length} active of{" "}
          {warehouses.length} total
        </p>
        <AddWarehouseDialog />
      </div>

      <div className="rounded-lg border border-border bg-card">
        {warehouses.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            No warehouses yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Address</th>
                <th className="px-4 py-3 font-medium">Default</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Edit</th>
              </tr>
            </thead>
            <tbody>
              {warehouses.map((w) => (
                <tr
                  key={w.id}
                  className="border-b border-border last:border-0 transition-colors hover:bg-muted/30"
                >
                  <td className="px-4 py-3 font-medium">{w.name}</td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                    {w.code}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {w.address ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    {w.isDefault ? (
                      <span className="rounded-full border border-[#00d992]/30 bg-[#00d992]/10 px-2 py-0.5 text-xs font-medium text-[#00d992]">
                        Default
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <WarehouseToggle warehouse={w} />
                  </td>
                  <td className="px-4 py-3">
                    <EditWarehouseDialog warehouse={w} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
