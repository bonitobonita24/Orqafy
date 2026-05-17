"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  MARKUP_TIERS,
  computeMarkedUpPrice,
  computeQuotationTotals,
  formatCurrency,
  validateQuotationDraft,
  type DraftLineItem,
  type DraftMarkupColumn,
  type DraftSection,
  type MarkupTier,
} from "@/lib/quotation-build";

interface CustomerOption {
  id: string;
  firstName: string;
  lastName: string;
  companyName: string | null;
}

export interface InitialQuotation {
  id: string;
  customerId: string;
  title: string;
  validUntil: Date | null;
  taxAmount: number;
  notes: string | null;
  termsAndConditions: string | null;
  markupColumns: DraftMarkupColumn[];
  sections: DraftSection[];
}

interface QuotationBuilderProps {
  slug: string;
  customers: CustomerOption[];
  initialQuotation?: InitialQuotation;
}

function newLineItem(): DraftLineItem {
  return {
    description: "",
    unit: "pcs",
    quantity: 1,
    baseCost: 0,
    sortOrder: 0,
    markups: [],
  };
}

function newSection(sortOrder: number): DraftSection {
  return {
    name: `Section ${sortOrder + 1}`,
    sortOrder,
    lineItems: [newLineItem()],
  };
}

function newMarkupColumn(sortOrder: number): DraftMarkupColumn {
  return {
    name: `Tier ${sortOrder + 1}`,
    tier: MARKUP_TIERS[sortOrder] ?? "tier1",
    percentage: 20,
    useCeiling: false,
    sortOrder,
  };
}

function customerLabel(c: CustomerOption): string {
  const company = c.companyName?.trim();
  if (company !== undefined && company.length > 0) return company;
  return `${c.firstName} ${c.lastName}`;
}

function dateInputValue(d: Date | null): string {
  if (d === null) return "";
  return d.toISOString().slice(0, 10);
}

export function QuotationBuilder({ slug, customers, initialQuotation }: QuotationBuilderProps) {
  const router = useRouter();
  const isEditMode = initialQuotation !== undefined;

  const [title, setTitle] = useState(initialQuotation?.title ?? "");
  const [customerId, setCustomerId] = useState(
    initialQuotation?.customerId ?? customers[0]?.id ?? "",
  );
  const [validUntilStr, setValidUntilStr] = useState(
    initialQuotation === undefined ? "" : dateInputValue(initialQuotation.validUntil),
  );
  const [taxAmount, setTaxAmount] = useState(initialQuotation?.taxAmount ?? 0);
  const [notes, setNotes] = useState(initialQuotation?.notes ?? "");
  const [terms, setTerms] = useState(initialQuotation?.termsAndConditions ?? "");

  const [markupColumns, setMarkupColumns] = useState<DraftMarkupColumn[]>(() =>
    initialQuotation !== undefined && initialQuotation.markupColumns.length > 0
      ? initialQuotation.markupColumns
      : [newMarkupColumn(0)],
  );
  const [sections, setSections] = useState<DraftSection[]>(() =>
    initialQuotation !== undefined && initialQuotation.sections.length > 0
      ? initialQuotation.sections
      : [newSection(0)],
  );

  const totals = useMemo(
    () => computeQuotationTotals({ sections, taxAmount }),
    [sections, taxAmount],
  );

  const validation = useMemo(
    () => validateQuotationDraft({ customerId, title, sections }),
    [customerId, title, sections],
  );

  const create = trpc.crm.quotationCreate.useMutation({
    onSuccess: (q) => {
      toast.success(`Quotation ${q.quotationNumber} created.`);
      router.push(`/${slug}/crm/quotations/${q.id}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const update = trpc.crm.quotationUpdate.useMutation({
    onSuccess: (q) => {
      toast.success(`Quotation ${q.quotationNumber} updated.`);
      router.push(`/${slug}/crm/quotations/${q.id}`);
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  // ── Markup columns ─────────────────────────────────────────────
  const addColumn = () =>
    setMarkupColumns((cols) => [...cols, newMarkupColumn(cols.length)]);

  const removeColumn = (index: number) =>
    setMarkupColumns((cols) =>
      cols.filter((_, i) => i !== index).map((c, i) => ({ ...c, sortOrder: i })),
    );

  const updateColumn = (index: number, patch: Partial<DraftMarkupColumn>) =>
    setMarkupColumns((cols) =>
      cols.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    );

  // ── Sections ───────────────────────────────────────────────────
  const addSection = () =>
    setSections((s) => [...s, newSection(s.length)]);

  const removeSection = (index: number) =>
    setSections((s) =>
      s.filter((_, i) => i !== index).map((sec, i) => ({ ...sec, sortOrder: i })),
    );

  const updateSection = (index: number, patch: Partial<DraftSection>) =>
    setSections((s) => s.map((sec, i) => (i === index ? { ...sec, ...patch } : sec)));

  // ── Line items ─────────────────────────────────────────────────
  const addLineItem = (sectionIndex: number) =>
    setSections((s) =>
      s.map((sec, i) =>
        i === sectionIndex
          ? {
              ...sec,
              lineItems: [
                ...sec.lineItems,
                { ...newLineItem(), sortOrder: sec.lineItems.length },
              ],
            }
          : sec,
      ),
    );

  const removeLineItem = (sectionIndex: number, itemIndex: number) =>
    setSections((s) =>
      s.map((sec, i) =>
        i === sectionIndex
          ? {
              ...sec,
              lineItems: sec.lineItems
                .filter((_, j) => j !== itemIndex)
                .map((li, j) => ({ ...li, sortOrder: j })),
            }
          : sec,
      ),
    );

  const updateLineItem = (
    sectionIndex: number,
    itemIndex: number,
    patch: Partial<DraftLineItem>,
  ) =>
    setSections((s) =>
      s.map((sec, i) =>
        i === sectionIndex
          ? {
              ...sec,
              lineItems: sec.lineItems.map((li, j) =>
                j === itemIndex ? { ...li, ...patch } : li,
              ),
            }
          : sec,
      ),
    );

  const handleSubmit = () => {
    if (!validation.ok) {
      toast.error(validation.reason);
      return;
    }

    // Build payload — auto-derive markups[] per line item from current columns.
    const payloadSections = sections.map((sec) => ({
      name: sec.name,
      ...(sec.description !== undefined && { description: sec.description }),
      sortOrder: sec.sortOrder,
      lineItems: sec.lineItems.map((li) => ({
        ...(li.productId !== undefined && { productId: li.productId }),
        description: li.description,
        unit: li.unit,
        quantity: li.quantity,
        baseCost: li.baseCost,
        sortOrder: li.sortOrder,
        markups: markupColumns.map((col, colIdx) => ({
          markupColumnIndex: colIdx,
          markedUpPrice: computeMarkedUpPrice(
            li.baseCost,
            col.percentage,
            col.useCeiling,
          ),
        })),
      })),
    }));

    const payloadMarkupColumns = markupColumns.map((c, i) => ({
      name: c.name,
      tier: c.tier,
      percentage: c.percentage,
      useCeiling: c.useCeiling,
      sortOrder: i,
    }));

    if (isEditMode && initialQuotation !== undefined) {
      update.mutate({
        id: initialQuotation.id,
        title,
        taxAmount,
        validUntil: validUntilStr.length > 0 ? new Date(validUntilStr) : null,
        notes,
        termsAndConditions: terms,
        markupColumns: payloadMarkupColumns,
        sections: payloadSections,
      });
      return;
    }

    create.mutate({
      customerId,
      title,
      taxAmount,
      currency: "PHP",
      ...(validUntilStr.length > 0 && { validUntil: new Date(validUntilStr) }),
      ...(notes.length > 0 && { notes }),
      ...(terms.length > 0 && { termsAndConditions: terms }),
      markupColumns: payloadMarkupColumns,
      sections: payloadSections,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header form ───────────────────────────────────────────── */}
      <div className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Q1 hardware refresh"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Customer</label>
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            disabled={isEditMode}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="">Select customer…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {customerLabel(c)}
              </option>
            ))}
          </select>
          {isEditMode ? (
            <p className="text-xs text-muted-foreground">
              Customer cannot be changed after creation.
            </p>
          ) : null}
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Valid until</label>
          <input
            type="date"
            value={validUntilStr}
            onChange={(e) => setValidUntilStr(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Tax amount</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={taxAmount}
            onChange={(e) => setTaxAmount(Number(e.target.value))}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground">
            Terms & Conditions
          </label>
          <textarea
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Markup columns ────────────────────────────────────────── */}
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="font-medium">Markup columns</h3>
          <button
            type="button"
            onClick={addColumn}
            className="rounded-md border border-border bg-background px-3 py-1 text-xs hover:bg-muted"
          >
            Add column
          </button>
        </div>
        <div className="space-y-2 p-4">
          {markupColumns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No markup columns.</p>
          ) : (
            markupColumns.map((col, idx) => (
              <div key={idx} className="grid items-end gap-2 sm:grid-cols-[1fr_120px_120px_120px_auto]">
                <input
                  type="text"
                  value={col.name}
                  onChange={(e) => updateColumn(idx, { name: e.target.value })}
                  placeholder="Column name"
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
                <select
                  value={col.tier}
                  onChange={(e) => updateColumn(idx, { tier: e.target.value as MarkupTier })}
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  {MARKUP_TIERS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={col.percentage}
                  onChange={(e) =>
                    updateColumn(idx, { percentage: Number(e.target.value) })
                  }
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                  placeholder="%"
                />
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={col.useCeiling}
                    onChange={(e) => updateColumn(idx, { useCeiling: e.target.checked })}
                  />
                  Ceiling
                </label>
                <button
                  type="button"
                  onClick={() => removeColumn(idx)}
                  className="rounded-md border border-red-400/30 px-2 py-1 text-xs text-red-400 hover:bg-red-400/10"
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Sections ──────────────────────────────────────────────── */}
      <div className="space-y-4">
        {sections.map((section, sIdx) => (
          <div key={sIdx} className="rounded-lg border border-border bg-card">
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
              <input
                type="text"
                value={section.name}
                onChange={(e) => updateSection(sIdx, { name: e.target.value })}
                className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium"
              />
              <button
                type="button"
                onClick={() => addLineItem(sIdx)}
                className="rounded-md border border-border bg-background px-3 py-1 text-xs hover:bg-muted"
              >
                Add item
              </button>
              <button
                type="button"
                onClick={() => removeSection(sIdx)}
                disabled={sections.length === 1}
                className="rounded-md border border-red-400/30 px-3 py-1 text-xs text-red-400 hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Remove section
              </button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Description</th>
                  <th className="px-3 py-2 font-medium w-20">Qty</th>
                  <th className="px-3 py-2 font-medium w-20">Unit</th>
                  <th className="px-3 py-2 font-medium w-28">Base cost</th>
                  {markupColumns.map((col, cIdx) => (
                    <th key={cIdx} className="px-3 py-2 text-right font-medium">
                      {col.name}
                    </th>
                  ))}
                  <th className="px-3 py-2 w-12" />
                </tr>
              </thead>
              <tbody>
                {section.lineItems.map((li, iIdx) => (
                  <tr key={iIdx} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={li.description}
                        onChange={(e) =>
                          updateLineItem(sIdx, iIdx, { description: e.target.value })
                        }
                        placeholder="Item description"
                        className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        step="0.0001"
                        value={li.quantity}
                        onChange={(e) =>
                          updateLineItem(sIdx, iIdx, { quantity: Number(e.target.value) })
                        }
                        className="w-full rounded-md border border-border bg-background px-2 py-1 text-right text-sm"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={li.unit}
                        onChange={(e) =>
                          updateLineItem(sIdx, iIdx, { unit: e.target.value })
                        }
                        className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={li.baseCost}
                        onChange={(e) =>
                          updateLineItem(sIdx, iIdx, { baseCost: Number(e.target.value) })
                        }
                        className="w-full rounded-md border border-border bg-background px-2 py-1 text-right text-sm"
                      />
                    </td>
                    {markupColumns.map((col, cIdx) => (
                      <td
                        key={cIdx}
                        className="px-3 py-2 text-right font-mono text-xs text-muted-foreground"
                      >
                        {formatCurrency(
                          computeMarkedUpPrice(li.baseCost, col.percentage, col.useCeiling),
                          "PHP",
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => removeLineItem(sIdx, iIdx)}
                        disabled={section.lineItems.length === 1}
                        className="rounded-md border border-red-400/30 px-2 py-1 text-xs text-red-400 hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        <button
          type="button"
          onClick={addSection}
          className="rounded-md border border-border bg-card px-4 py-2 text-sm hover:bg-muted"
        >
          Add section
        </button>
      </div>

      {/* Totals + Submit ─────────────────────────────────────── */}
      <div className="flex items-end justify-between gap-4 rounded-lg border border-border bg-card p-4">
        <div className="text-sm">
          {!validation.ok ? (
            <p className="text-red-400">{validation.reason}</p>
          ) : (
            <p className="text-muted-foreground">Ready to create.</p>
          )}
        </div>
        <div className="space-y-1 text-right text-sm">
          <div className="flex justify-between gap-6">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-mono">{formatCurrency(totals.subtotal)}</span>
          </div>
          <div className="flex justify-between gap-6">
            <span className="text-muted-foreground">Tax</span>
            <span className="font-mono">{formatCurrency(totals.taxAmount)}</span>
          </div>
          <div className="flex justify-between gap-6 border-t border-border pt-1 text-base font-semibold">
            <span>Total</span>
            <span className="font-mono">{formatCurrency(totals.totalAmount)}</span>
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!validation.ok || create.isPending || update.isPending}
            className="mt-2 inline-flex w-full justify-center rounded-md bg-[#00d992] px-4 py-2 text-sm font-medium text-black hover:bg-[#00d992]/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isEditMode
              ? update.isPending
                ? "Saving…"
                : "Save changes"
              : create.isPending
                ? "Creating…"
                : "Create quotation"}
          </button>
        </div>
      </div>
    </div>
  );
}
