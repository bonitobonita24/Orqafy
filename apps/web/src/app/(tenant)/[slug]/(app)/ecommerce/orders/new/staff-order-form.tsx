"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
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

// ─── types ────────────────────────────────────────────────────────────────────

interface LineItem {
  productId: string;
  productName: string;
  quantity: string;
  unitPrice: string;
}

interface FormValues {
  customerId: string;
  warehouseId: string;
  items: LineItem[];
  taxAmount: string;
  shippingAmount: string;
  discountAmount: string;
  paymentMethod: string;
  notes: string;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function customerLabel(c: {
  companyName?: string | null;
  firstName: string;
  lastName: string;
}): string {
  const co = c.companyName?.trim();
  if (co !== undefined && co.length > 0) return co;
  return `${c.firstName} ${c.lastName}`.trim();
}

function toNum(v: string): number {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

// ─── component ────────────────────────────────────────────────────────────────

interface StaffOrderFormProps {
  slug: string;
}

export function StaffOrderForm({ slug }: StaffOrderFormProps) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── server data ──
  const { data: warehouseData } = trpc.inventory.warehouseList.useQuery(undefined);
  const { data: customerData } = trpc.crm.customerList.useQuery({
    page: 1,
    limit: 200,
  });
  const { data: productData } = trpc.inventory.productList.useQuery({
    page: 1,
    limit: 200,
    isActive: true,
  });

  const warehouses = warehouseData ?? [];
  const customers = customerData?.items ?? [];
  const products = productData?.items ?? [];

  // ── form ──
  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      customerId: "",
      warehouseId: "",
      items: [{ productId: "", productName: "", quantity: "1", unitPrice: "0" }],
      taxAmount: "0",
      shippingAmount: "0",
      discountAmount: "0",
      paymentMethod: "",
      notes: "",
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  const watchedItems = watch("items");
  const watchedTax = watch("taxAmount");
  const watchedShipping = watch("shippingAmount");
  const watchedDiscount = watch("discountAmount");

  const lineTotal = watchedItems.reduce(
    (sum, item) => sum + toNum(item.quantity) * toNum(item.unitPrice),
    0,
  );
  const grandTotal =
    lineTotal + toNum(watchedTax) + toNum(watchedShipping) - toNum(watchedDiscount);

  // ── mutation ──
  const placeMutation = trpc.storefront.placeOrder.useMutation({
    onSuccess: () => {
      toast.success("Order placed successfully.");
      router.push(`/${slug}/ecommerce/orders`);
    },
    onError: (err) => {
      setSubmitError(err.message);
      toast.error(err.message);
    },
  });

  // ── submit ──
  function onSubmit(data: FormValues) {
    setSubmitError(null);

    const parsedItems = data.items.map((item) => ({
      productId: item.productId,
      quantity: parseInt(item.quantity, 10),
      unitPrice: parseFloat(item.unitPrice),
    }));

    placeMutation.mutate({
      customerId: data.customerId,
      warehouseId: data.warehouseId,
      items: parsedItems,
      taxAmount: toNum(data.taxAmount),
      shippingAmount: toNum(data.shippingAmount),
      discountAmount: toNum(data.discountAmount),
      paymentMethod: data.paymentMethod.trim() !== "" ? data.paymentMethod.trim() : undefined,
      notes: data.notes.trim() !== "" ? data.notes.trim() : undefined,
    });
  }

  // ── render ──
  return (
    <form onSubmit={(e) => { void handleSubmit(onSubmit)(e); }} className="space-y-8">
      {/* ── customer + warehouse ── */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Order details</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* customer */}
          <div className="space-y-1.5">
            <Label htmlFor="customerId">Customer *</Label>
            <Select
              onValueChange={(v) => setValue("customerId", v)}
            >
              <SelectTrigger id="customerId" className="w-full">
                <SelectValue placeholder="Select customer…" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {customerLabel(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* hidden input so RHF validation can catch it */}
            <input
              type="hidden"
              {...register("customerId", { required: "Customer is required" })}
            />
            {errors.customerId && (
              <p className="text-xs text-red-400">{errors.customerId.message}</p>
            )}
          </div>

          {/* warehouse */}
          <div className="space-y-1.5">
            <Label htmlFor="warehouseId">Warehouse *</Label>
            <Select
              onValueChange={(v) => setValue("warehouseId", v)}
            >
              <SelectTrigger id="warehouseId" className="w-full">
                <SelectValue placeholder="Select warehouse…" />
              </SelectTrigger>
              <SelectContent>
                {warehouses.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input
              type="hidden"
              {...register("warehouseId", { required: "Warehouse is required" })}
            />
            {errors.warehouseId && (
              <p className="text-xs text-red-400">{errors.warehouseId.message}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* payment method */}
          <div className="space-y-1.5">
            <Label htmlFor="paymentMethod">Payment method</Label>
            <Select
              onValueChange={(v) => setValue("paymentMethod", v)}
            >
              <SelectTrigger id="paymentMethod" className="w-full">
                <SelectValue placeholder="Select method…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cod">Cash on Delivery</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="xendit">Xendit</SelectItem>
              </SelectContent>
            </Select>
            <input type="hidden" {...register("paymentMethod")} />
          </div>

          {/* notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              placeholder="Internal notes…"
              {...register("notes")}
            />
          </div>
        </div>
      </div>

      {/* ── line items ── */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Line items</h2>
          <Button
            type="button"
            variant="outline"
            className="h-7 px-2 text-xs border-[#00d992]/40 text-[#00d992] hover:bg-[#00d992]/10"
            onClick={() =>
              append({ productId: "", productName: "", quantity: "1", unitPrice: "0" })
            }
          >
            + Add item
          </Button>
        </div>

        {fields.length === 0 && (
          <p className="text-xs text-muted-foreground">No items added yet.</p>
        )}

        <div className="space-y-3">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="grid grid-cols-12 gap-2 items-end rounded-md border border-border bg-background p-3"
            >
              {/* product selector */}
              <div className="col-span-12 sm:col-span-5 space-y-1">
                <Label className="text-xs text-muted-foreground">Product *</Label>
                <Select
                  onValueChange={(productId) => {
                    const prod = products.find((p) => p.id === productId);
                    if (!prod) return;
                    setValue(`items.${index}.productId`, productId);
                    setValue(`items.${index}.productName`, prod.name);
                    // prefill unitPrice from tier1Price if present
                    const t1 = prod.tier1Price;
                    if (t1 !== null && t1 !== undefined) {
                      setValue(`items.${index}.unitPrice`, String(Number(t1)));
                    }
                  }}
                >
                  <SelectTrigger className="w-full h-8 text-xs">
                    <SelectValue placeholder="Select product…" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                        {p.sku != null && p.sku.length > 0 ? ` (${p.sku})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input
                  type="hidden"
                  {...register(`items.${index}.productId`, {
                    required: "Product required",
                  })}
                />
                <input
                  type="hidden"
                  {...register(`items.${index}.productName`)}
                />
                {errors.items?.[index]?.productId && (
                  <p className="text-xs text-red-400">
                    {errors.items[index]?.productId?.message}
                  </p>
                )}
              </div>

              {/* quantity */}
              <div className="col-span-4 sm:col-span-2 space-y-1">
                <Label className="text-xs text-muted-foreground">Qty *</Label>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  className="h-8 text-xs"
                  {...register(`items.${index}.quantity`, {
                    required: "Required",
                    min: { value: 1, message: "Min 1" },
                    validate: (v) =>
                      Number.isInteger(parseFloat(v)) || "Must be whole number",
                  })}
                />
                {errors.items?.[index]?.quantity && (
                  <p className="text-xs text-red-400">
                    {errors.items[index]?.quantity?.message}
                  </p>
                )}
              </div>

              {/* unit price */}
              <div className="col-span-5 sm:col-span-3 space-y-1">
                <Label className="text-xs text-muted-foreground">Unit price *</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  className="h-8 text-xs"
                  {...register(`items.${index}.unitPrice`, {
                    required: "Required",
                    min: { value: 0, message: "Min 0" },
                  })}
                />
                {errors.items?.[index]?.unitPrice && (
                  <p className="text-xs text-red-400">
                    {errors.items[index]?.unitPrice?.message}
                  </p>
                )}
              </div>

              {/* line subtotal */}
              <div className="col-span-2 sm:col-span-1 space-y-1 text-right">
                <Label className="text-xs text-muted-foreground">Subtotal</Label>
                <p className="h-8 flex items-center justify-end text-xs text-muted-foreground">
                  {(
                    toNum(watchedItems[index]?.quantity ?? "0") *
                    toNum(watchedItems[index]?.unitPrice ?? "0")
                  ).toLocaleString("en-PH", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>

              {/* remove */}
              <div className="col-span-1 flex items-end justify-end pb-0.5">
                {fields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="text-muted-foreground hover:text-red-400 text-lg leading-none"
                    aria-label="Remove item"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* RHF array-level error */}
        {errors.items?.root && (
          <p className="text-xs text-red-400">{errors.items.root.message}</p>
        )}
      </div>

      {/* ── charges ── */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Charges &amp; discounts</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="taxAmount">Tax</Label>
            <Input
              id="taxAmount"
              type="number"
              min={0}
              step={0.01}
              {...register("taxAmount", { min: { value: 0, message: "Min 0" } })}
            />
            {errors.taxAmount && (
              <p className="text-xs text-red-400">{errors.taxAmount.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="shippingAmount">Shipping</Label>
            <Input
              id="shippingAmount"
              type="number"
              min={0}
              step={0.01}
              {...register("shippingAmount", { min: { value: 0, message: "Min 0" } })}
            />
            {errors.shippingAmount && (
              <p className="text-xs text-red-400">{errors.shippingAmount.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="discountAmount">Discount</Label>
            <Input
              id="discountAmount"
              type="number"
              min={0}
              step={0.01}
              {...register("discountAmount", { min: { value: 0, message: "Min 0" } })}
            />
            {errors.discountAmount && (
              <p className="text-xs text-red-400">{errors.discountAmount.message}</p>
            )}
          </div>
        </div>

        {/* order total */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
          <span className="text-sm text-muted-foreground">Order total</span>
          <span className="text-lg font-semibold text-[#00d992]">
            ₱
            {grandTotal.toLocaleString("en-PH", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>
      </div>

      {/* ── submit ── */}
      {submitError !== null && (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-400">
          {submitError}
        </p>
      )}

      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          className="border-border text-muted-foreground"
          onClick={() => router.push(`/${slug}/ecommerce/orders`)}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={placeMutation.isPending}
          className="bg-[#00d992]/10 text-[#00d992] border border-[#00d992]/40 hover:bg-[#00d992]/20"
          variant="outline"
        >
          {placeMutation.isPending ? "Placing order…" : "Place order"}
        </Button>
      </div>
    </form>
  );
}
