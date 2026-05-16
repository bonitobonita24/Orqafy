"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  PAYMENT_METHODS,
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
  const defaultWarehouseId =
    warehouses.find((w) => w.isDefault)?.id ?? warehouses[0]?.id ?? null;
  const [warehouseId, setWarehouseId] = useState<string | null>(defaultWarehouseId);
  const [items, setItems] = useState<CartLineItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [taxAmount, setTaxAmount] = useState<number>(0);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [notes, setNotes] = useState("");

  const filteredProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (term === "") return products.slice(0, 30);
    return products
      .filter((p) => {
        return (
          p.name.toLowerCase().includes(term) ||
          (p.sku?.toLowerCase().includes(term) ?? false)
        );
      })
      .slice(0, 30);
  }, [products, searchTerm]);

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

  function handleSubmit() {
    if (!validation.canCheckout) return;
    if (sessionId === null || warehouseId === null) return;
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

  return (
    <div className="space-y-6">
      {/* Header controls — session + warehouse */}
      <section className="grid gap-4 rounded-lg border border-border bg-card p-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Open Session
          </label>
          {openSessions.length === 0 ? (
            <p className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              No open sessions. Open one in POS Sessions first.
            </p>
          ) : (
            <select
              value={sessionId ?? ""}
              onChange={(e) => setSessionId(e.target.value === "" ? null : e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">— Select session —</option>
              {openSessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.sessionNumber} · {s.cashier}
                </option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Warehouse
          </label>
          {warehouses.length === 0 ? (
            <p className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              No active warehouses configured.
            </p>
          ) : (
            <select
              value={warehouseId ?? ""}
              onChange={(e) => setWarehouseId(e.target.value === "" ? null : e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} · {w.name}
                  {w.isDefault ? " (default)" : ""}
                </option>
              ))}
            </select>
          )}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        {/* LEFT — Product picker */}
        <section className="rounded-lg border border-border bg-card">
          <header className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Add Products</h2>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or SKU"
              className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </header>
          <ul className="max-h-[400px] divide-y divide-border overflow-y-auto">
            {filteredProducts.length === 0 ? (
              <li className="px-4 py-6 text-center text-xs text-muted-foreground">
                No products match.
              </li>
            ) : (
              filteredProducts.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between px-4 py-2 transition-colors hover:bg-muted/30"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.sku ?? "no sku"} · {p.unit} ·{" "}
                      {p.tier1Price !== null
                        ? formatCurrency(p.tier1Price)
                        : "no price"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddProduct(p)}
                    className="ml-3 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium hover:bg-muted"
                  >
                    + Add
                  </button>
                </li>
              ))
            )}
          </ul>
        </section>

        {/* RIGHT — Cart + payment */}
        <section className="rounded-lg border border-border bg-card">
          <header className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Cart</h2>
            <p className="text-xs text-muted-foreground">
              {items.length} {items.length === 1 ? "item" : "items"}
            </p>
          </header>

          {items.length === 0 ? (
            <div className="px-4 py-10 text-center text-xs text-muted-foreground">
              Cart is empty. Add products from the left.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Item</th>
                  <th className="px-3 py-2 text-right font-medium">Qty</th>
                  <th className="px-3 py-2 text-right font-medium">Unit Price</th>
                  <th className="px-3 py-2 text-right font-medium">Total</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.productId} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">
                      <div className="font-medium">{i.description}</div>
                      <div className="text-xs text-muted-foreground">{i.unit}</div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={i.quantity}
                        onChange={(e) => {
                          const q = Number(e.target.value);
                          setItems((prev) =>
                            setQuantity(prev, i.productId, Number.isFinite(q) ? q : 0),
                          );
                        }}
                        className="w-20 rounded-md border border-border bg-background px-2 py-1 text-right text-sm"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={i.unitPrice}
                        onChange={(e) => {
                          const p = Number(e.target.value);
                          setItems((prev) =>
                            prev.map((it) =>
                              it.productId === i.productId
                                ? { ...it, unitPrice: Number.isFinite(p) ? p : 0 }
                                : it,
                            ),
                          );
                        }}
                        className="w-24 rounded-md border border-border bg-background px-2 py-1 text-right text-sm"
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs">
                      {formatCurrency(i.quantity * i.unitPrice)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        aria-label="Remove item"
                        onClick={() =>
                          setItems((prev) => removeItem(prev, i.productId))
                        }
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Totals + payment block */}
          <div className="space-y-3 border-t border-border px-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs">
                <span className="block text-muted-foreground">Tax</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={taxAmount}
                  onChange={(e) => setTaxAmount(Number(e.target.value) || 0)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-right text-sm"
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
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-right text-sm"
                />
              </label>
            </div>

            <dl className="space-y-1 rounded-md bg-muted/30 px-3 py-2 font-mono text-xs">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd>{formatCurrency(totals.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Tax</dt>
                <dd>{formatCurrency(totals.taxAmount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Discount</dt>
                <dd>− {formatCurrency(totals.discountAmount)}</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-1 text-sm font-semibold">
                <dt>Total</dt>
                <dd>{formatCurrency(totals.totalAmount)}</dd>
              </div>
            </dl>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs">
                <span className="block text-muted-foreground">Payment Method</span>
                <select
                  value={paymentMethod}
                  onChange={(e) =>
                    setPaymentMethod(e.target.value as PaymentMethod)
                  }
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs">
                <span className="block text-muted-foreground">Amount Paid</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(Number(e.target.value) || 0)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-right text-sm"
                />
              </label>
            </div>

            {paymentMethod === "cash" && (
              <div className="flex justify-between rounded-md bg-muted/30 px-3 py-2 font-mono text-xs">
                <span className="text-muted-foreground">Change</span>
                <span className="font-semibold">{formatCurrency(change)}</span>
              </div>
            )}

            <label className="block text-xs">
              <span className="block text-muted-foreground">Notes</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
              />
            </label>

            {validation.reason !== null && (
              <p className="text-xs text-amber-500">{validation.reason}</p>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!validation.canCheckout || createSale.isPending}
              className="w-full rounded-md bg-[#00d992] px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {createSale.isPending ? "Processing…" : "Complete Sale"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
