"use client";

// New Sale register — re-grafted onto the RestroPOS main-screen layout
// (starter/restropos/src/views/apps/pos/index.tsx + left-panel/index.tsx +
// right-panel/index.tsx, interaction reference ONLY — never imported).
// Wiring + cart math stay OURS: lib/pos-cart.ts + server/trpc/routers/pos.ts
// (sale.create, atomic inventory decrement). Out of scope: tables/seating/
// KDS/reservations/addons/coupons/FoodType — none of that is grafted here.

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  addOrIncrementItem,
  computeCartTotals,
  computeChange,
  formatCurrency,
  removeItem,
  setQuantity,
  validateCart,
  type CartLineItem,
  type PaymentMethod,
} from "@/lib/pos-cart";
import { Badge } from "@/components/ui/badge";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Minus, Plus, Search, ShoppingCart, Trash2, X } from "@/components/ui/icons";
import { ProductCard } from "./product-card";
import { CheckoutDialog } from "./checkout-dialog";
import { ReceiptDialog, type ReceiptSale } from "./receipt-dialog";

const ALL = "all";

interface SessionOption {
  id: string;
  sessionNumber: string;
  cashier: string;
}

interface WarehouseOption {
  id: string;
  name: string;
  code: string;
  isDefault: boolean;
}

interface ProductOption {
  id: string;
  sku: string | null;
  name: string;
  unit: string;
  tier1Price: number | null;
  categoryId: string | null;
  categoryName: string | null;
  imageUrl: string | null;
  stockByWarehouse: Array<{ warehouseId: string; quantity: number }>;
}

interface Props {
  openSessions: SessionOption[];
  warehouses: WarehouseOption[];
  products: ProductOption[];
}

export function CartClient({ openSessions, warehouses, products }: Props) {
  const [sessionId, setSessionId] = useState<string | null>(
    openSessions.length === 1 ? (openSessions[0]?.id ?? null) : null,
  );
  const defaultWarehouseId = warehouses.find((w) => w.isDefault)?.id ?? warehouses[0]?.id ?? null;
  const [warehouseId, setWarehouseId] = useState<string | null>(defaultWarehouseId);
  const [items, setItems] = useState<CartLineItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategoryId, setActiveCategoryId] = useState<string>(ALL);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [taxAmount, setTaxAmount] = useState<number>(0);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [receiptSale, setReceiptSale] = useState<ReceiptSale | null>(null);
  const pendingItemsRef = useRef<CartLineItem[]>([]);

  const categories = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of products) {
      if (p.categoryId !== null && p.categoryName !== null) seen.set(p.categoryId, p.categoryName);
    }
    return Array.from(seen, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [products]);

  const filteredProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    let list = products;
    if (activeCategoryId !== ALL) list = list.filter((p) => p.categoryId === activeCategoryId);
    if (term !== "") {
      list = list.filter(
        (p) => p.name.toLowerCase().includes(term) || (p.sku?.toLowerCase().includes(term) ?? false),
      );
    }
    return list;
  }, [products, searchTerm, activeCategoryId]);

  const cartQtyByProduct = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of items) m.set(i.productId, i.quantity);
    return m;
  }, [items]);

  const totals = useMemo(
    () => computeCartTotals(items, { taxAmount, discountAmount }),
    [items, taxAmount, discountAmount],
  );
  const change = useMemo(
    () => computeChange(totals.totalAmount, amountPaid, paymentMethod),
    [totals.totalAmount, amountPaid, paymentMethod],
  );
  const validation = useMemo(
    () => validateCart({ items, amountPaid, paymentMethod, totals, sessionId }),
    [items, amountPaid, paymentMethod, totals, sessionId],
  );

  const createSale = trpc.pos.sale.create.useMutation({
    onSuccess: (sale) => {
      toast.success(`Sale ${sale.saleNumber} recorded.`);
      setReceiptSale({
        saleNumber: sale.saleNumber,
        createdAt: sale.createdAt.toString(),
        items: pendingItemsRef.current,
        subtotal: Number(sale.subtotal),
        taxAmount: Number(sale.taxAmount),
        discountAmount: Number(sale.discountAmount),
        totalAmount: Number(sale.totalAmount),
        amountPaid: Number(sale.amountPaid),
        changeAmount: Number(sale.changeAmount),
        paymentMethod: sale.paymentMethod as PaymentMethod,
      });
      setCheckoutOpen(false);
      setItems([]);
      setAmountPaid(0);
      setTaxAmount(0);
      setDiscountAmount(0);
      setNotes("");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  function availableQtyFor(p: ProductOption): number | null {
    if (p.stockByWarehouse.length === 0) return null;
    const row = p.stockByWarehouse.find((s) => s.warehouseId === warehouseId);
    return row ? row.quantity : 0;
  }

  function handleAddProduct(p: ProductOption) {
    const unitPrice = p.tier1Price ?? 0;
    setItems((prev) =>
      addOrIncrementItem(prev, {
        productId: p.id,
        description: p.name,
        unit: p.unit,
        quantity: 1,
        unitPrice,
      }),
    );
  }

  function handleDecrementProduct(productId: string) {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === productId);
      if (!existing) return prev;
      return setQuantity(prev, productId, existing.quantity - 1);
    });
  }

  function handleConfirmCheckout() {
    if (!validation.canCheckout) return;
    if (sessionId === null || warehouseId === null) return;
    pendingItemsRef.current = items;
    createSale.mutate({
      sessionId,
      warehouseId,
      items: items.map((i) => ({
        productId: i.productId,
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })),
      taxAmount,
      discountAmount,
      amountPaid,
      paymentMethod,
      ...(notes.trim().length > 0 ? { notes: notes.trim() } : {}),
    });
  }

  const totalCartQty = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div className="grid min-h-0 flex-1 gap-3 overflow-hidden lg:grid-cols-[1fr_380px]">
      {/* LEFT — product grid */}
      <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
        <header className="shrink-0 space-y-2 border-b border-border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <InputGroup className="w-full max-w-64">
              <InputGroupAddon>
                <Search className="size-4" />
              </InputGroupAddon>
              <InputGroupInput
                placeholder="Search by name or SKU"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm !== "" && (
                <InputGroupAddon align="inline-end">
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-4" />
                    <span className="sr-only">Clear search</span>
                  </button>
                </InputGroupAddon>
              )}
            </InputGroup>

            {/* Session + warehouse — compact selects */}
            <select
              value={sessionId ?? ""}
              onChange={(e) => setSessionId(e.target.value === "" ? null : e.target.value)}
              disabled={openSessions.length === 0}
              className="h-9 rounded-md border border-input bg-background px-2 text-xs disabled:opacity-50"
            >
              <option value="">— Session —</option>
              {openSessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.sessionNumber} · {s.cashier}
                </option>
              ))}
            </select>
            <select
              value={warehouseId ?? ""}
              onChange={(e) => setWarehouseId(e.target.value === "" ? null : e.target.value)}
              disabled={warehouses.length === 0}
              className="h-9 rounded-md border border-input bg-background px-2 text-xs disabled:opacity-50"
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} · {w.name}
                  {w.isDefault ? " (default)" : ""}
                </option>
              ))}
            </select>
          </div>

          <Tabs value={activeCategoryId} onValueChange={setActiveCategoryId}>
            <ScrollArea>
              <TabsList className="my-px">
                <TabsTrigger value={ALL} className="px-3 text-xs">
                  All
                </TabsTrigger>
                {categories.map((c) => (
                  <TabsTrigger key={c.id} value={c.id} className="px-3 text-xs">
                    {c.name}
                  </TabsTrigger>
                ))}
              </TabsList>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </Tabs>
        </header>

        <ScrollArea className="min-h-0 flex-1">
          <div className="p-3">
            {filteredProducts.length === 0 ? (
              <div className="flex h-48 items-center justify-center text-xs text-muted-foreground">
                No products match.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {filteredProducts.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    quantityInCart={cartQtyByProduct.get(p.id) ?? 0}
                    availableQty={availableQtyFor(p)}
                    onAdd={() => handleAddProduct(p)}
                    onDecrement={() => handleDecrementProduct(p.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="shrink-0 border-t border-border px-4 py-2 text-xs text-muted-foreground">
          {filteredProducts.length} {filteredProducts.length === 1 ? "item" : "items"}
        </div>
      </section>

      {/* RIGHT — cart */}
      <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Cart</span>
            {totalCartQty > 0 && <Badge>{totalCartQty}</Badge>}
          </div>
          {items.length > 0 && (
            <button
              type="button"
              aria-label="Clear cart"
              onClick={() => setItems([])}
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-4" />
            </button>
          )}
        </header>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8">
            <div className="flex size-16 items-center justify-center rounded-full bg-muted">
              <ShoppingCart className="size-7 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="font-medium">Cart is empty</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Tap products on the left to add them here
              </p>
            </div>
          </div>
        ) : (
          <>
            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-2 p-3">
                {items.map((i) => (
                  <div
                    key={i.productId}
                    className="flex items-center gap-2 rounded-md border border-border p-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{i.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(i.unitPrice)} · {i.unit}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        aria-label={`Decrease ${i.description} quantity`}
                        onClick={() => setItems((prev) => setQuantity(prev, i.productId, i.quantity - 1))}
                        className="flex size-6 items-center justify-center rounded-md border border-input hover:bg-accent"
                      >
                        <Minus className="size-3" />
                      </button>
                      <span className="w-6 text-center text-sm tabular-nums">{i.quantity}</span>
                      <button
                        type="button"
                        aria-label={`Increase ${i.description} quantity`}
                        onClick={() => setItems((prev) => setQuantity(prev, i.productId, i.quantity + 1))}
                        className="flex size-6 items-center justify-center rounded-md border border-input hover:bg-accent"
                      >
                        <Plus className="size-3" />
                      </button>
                    </div>
                    <span className="w-16 shrink-0 text-right font-mono text-xs">
                      {formatCurrency(i.quantity * i.unitPrice)}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${i.description}`}
                      onClick={() => setItems((prev) => removeItem(prev, i.productId))}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <Separator />

            {/* Totals + tax/discount + checkout trigger */}
            <div className="shrink-0 space-y-2 p-3">
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs">
                  <span className="block text-muted-foreground">Tax</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={taxAmount}
                    onChange={(e) => setTaxAmount(Number(e.target.value) || 0)}
                    className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1 text-right text-sm"
                  />
                </label>
                <label className="text-xs">
                  <span className="block text-muted-foreground">Discount</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(Number(e.target.value) || 0)}
                    className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1 text-right text-sm"
                  />
                </label>
              </div>

              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sub total</span>
                  <span className="tabular-nums">{formatCurrency(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="tabular-nums">{formatCurrency(totals.taxAmount)}</span>
                </div>
                {totals.discountAmount > 0 && (
                  <div className="flex justify-between text-primary">
                    <span>Discount</span>
                    <span className="tabular-nums">− {formatCurrency(totals.discountAmount)}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="font-semibold">Total</span>
                <span className="text-lg font-bold tabular-nums">{formatCurrency(totals.totalAmount)}</span>
              </div>

              <button
                type="button"
                onClick={() => setCheckoutOpen(true)}
                disabled={!validation.hasSession || !validation.hasItems || !validation.totalNonNegative}
                className="w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Proceed to Payment
              </button>

              {validation.reason !== null && (
                <p className="text-center text-xs text-amber-500">{validation.reason}</p>
              )}
            </div>
          </>
        )}
      </section>

      <CheckoutDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        itemCount={totalCartQty}
        totals={totals}
        paymentMethod={paymentMethod}
        onPaymentMethodChange={setPaymentMethod}
        amountPaid={amountPaid}
        onAmountPaidChange={setAmountPaid}
        change={change}
        notes={notes}
        onNotesChange={setNotes}
        canCheckout={validation.canCheckout}
        reason={validation.reason}
        isPending={createSale.isPending}
        onConfirm={handleConfirmCheckout}
      />

      <ReceiptDialog sale={receiptSale} onClose={() => setReceiptSale(null)} />
    </div>
  );
}

