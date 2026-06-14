"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
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

interface Category {
  id: string;
  name: string;
}

interface ProductFormProps {
  slug: string;
  categories: Category[];
  mode: "create";
  defaultValues?: undefined;
  productId?: undefined;
}

interface ProductEditFormProps {
  slug: string;
  categories: Category[];
  mode: "edit";
  productId: string;
  defaultValues: {
    name: string;
    sku: string | null;
    barcode: string | null;
    description: string | null;
    categoryId: string | null;
    unit: string;
    baseCost: string;
    reorderLevel: number | null;
    isActive: boolean;
    isSerialTracked: boolean;
  };
}

type Props = ProductFormProps | ProductEditFormProps;

export function ProductForm(props: Props) {
  const router = useRouter();
  const { slug, categories, mode } = props;

  const dv = mode === "edit" ? props.defaultValues : null;

  const [name, setName] = useState(dv?.name ?? "");
  const [sku, setSku] = useState(dv?.sku ?? "");
  const [barcode, setBarcode] = useState(dv?.barcode ?? "");
  const [description, setDescription] = useState(dv?.description ?? "");
  const [categoryId, setCategoryId] = useState(dv?.categoryId ?? "");
  const [unit, setUnit] = useState(dv?.unit ?? "pcs");
  const [baseCost, setBaseCost] = useState(
    dv?.baseCost !== undefined ? String(dv.baseCost) : "0",
  );
  const [reorderLevel, setReorderLevel] = useState(
    dv?.reorderLevel !== null && dv?.reorderLevel !== undefined
      ? String(dv.reorderLevel)
      : "",
  );
  const [reorderQuantity, setReorderQuantity] = useState("");
  const [isSerialTracked, setIsSerialTracked] = useState(
    dv?.isSerialTracked ?? false,
  );
  const [error, setError] = useState<string | null>(null);

  const create = trpc.inventory.productCreate.useMutation({
    onSuccess: () => {
      toast.success("Product created.");
      router.push(`/${slug}/inventory`);
      router.refresh();
    },
    onError: (err) => {
      setError(err.message);
      toast.error(err.message);
    },
  });

  const update = trpc.inventory.productUpdate.useMutation({
    onSuccess: () => {
      toast.success("Product updated.");
      router.push(`/${slug}/inventory`);
      router.refresh();
    },
    onError: (err) => {
      setError(err.message);
      toast.error(err.message);
    },
  });

  const isPending = create.isPending || update.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (name.trim() === "") {
      setError("Product name is required.");
      return;
    }

    const parsedCost = parseFloat(baseCost);
    if (isNaN(parsedCost) || parsedCost < 0) {
      setError("Base cost must be a number ≥ 0.");
      return;
    }

    const parsedReorderLevel =
      reorderLevel.trim() !== "" ? parseInt(reorderLevel, 10) : undefined;
    const parsedReorderQty =
      reorderQuantity.trim() !== "" ? parseInt(reorderQuantity, 10) : undefined;

    if (mode === "create") {
      create.mutate({
        name: name.trim(),
        sku: sku.trim() !== "" ? sku.trim() : undefined,
        barcode: barcode.trim() !== "" ? barcode.trim() : undefined,
        description: description.trim() !== "" ? description.trim() : undefined,
        categoryId: categoryId !== "" ? categoryId : undefined,
        unit: unit.trim() !== "" ? unit.trim() : "pcs",
        baseCost: parsedCost,
        reorderLevel: parsedReorderLevel,
        reorderQuantity: parsedReorderQty,
        isSerialTracked,
      });
    } else {
      update.mutate({
        id: props.productId,
        name: name.trim() !== "" ? name.trim() : undefined,
        sku: sku.trim() !== "" ? sku.trim() : undefined,
        barcode: barcode.trim() !== "" ? barcode.trim() : undefined,
        description: description.trim() !== "" ? description.trim() : undefined,
        categoryId: categoryId !== "" ? categoryId : undefined,
        unit: unit.trim() !== "" ? unit.trim() : undefined,
        baseCost: parsedCost,
        reorderLevel: parsedReorderLevel,
      });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-xl">
      {error !== null && (
        <p className="rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Office Chair"
          disabled={isPending}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="sku">SKU</Label>
          <Input
            id="sku"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder="e.g. CHR-001"
            disabled={isPending}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="barcode">Barcode</Label>
          <Input
            id="barcode"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder="e.g. 1234567890123"
            disabled={isPending}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional product description"
          rows={3}
          disabled={isPending}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="category">Category</Label>
          <Select
            value={categoryId}
            onValueChange={(v) => setCategoryId(v === "__none__" ? "" : v)}
            disabled={isPending}
          >
            <SelectTrigger id="category">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— None —</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="unit">Unit</Label>
          <Input
            id="unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="pcs"
            disabled={isPending}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="baseCost">Base Cost</Label>
        <Input
          id="baseCost"
          type="number"
          min="0"
          step="0.01"
          value={baseCost}
          onChange={(e) => setBaseCost(e.target.value)}
          disabled={isPending}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="reorderLevel">Reorder Level</Label>
          <Input
            id="reorderLevel"
            type="number"
            min="0"
            step="1"
            value={reorderLevel}
            onChange={(e) => setReorderLevel(e.target.value)}
            placeholder="e.g. 10"
            disabled={isPending}
          />
        </div>
        {mode === "create" && (
          <div className="space-y-1.5">
            <Label htmlFor="reorderQuantity">Reorder Quantity</Label>
            <Input
              id="reorderQuantity"
              type="number"
              min="0"
              step="1"
              value={reorderQuantity}
              onChange={(e) => setReorderQuantity(e.target.value)}
              placeholder="e.g. 50"
              disabled={isPending}
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <input
          id="isSerialTracked"
          type="checkbox"
          checked={isSerialTracked}
          onChange={(e) => setIsSerialTracked(e.target.checked)}
          disabled={isPending || mode === "edit"}
          className="h-4 w-4 rounded border-border accent-[#00d992]"
        />
        <Label htmlFor="isSerialTracked" className="cursor-pointer">
          Serial tracked
          {mode === "edit" && (
            <span className="ml-1 text-xs text-muted-foreground">
              (cannot change after creation)
            </span>
          )}
        </Label>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md border border-[#00d992] bg-[#00d992]/10 px-4 py-2 text-sm font-medium text-[#00d992] hover:bg-[#00d992]/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending
            ? mode === "create"
              ? "Creating…"
              : "Saving…"
            : mode === "create"
              ? "Create Product"
              : "Save Changes"}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => router.push(`/${slug}/inventory`)}
          className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
