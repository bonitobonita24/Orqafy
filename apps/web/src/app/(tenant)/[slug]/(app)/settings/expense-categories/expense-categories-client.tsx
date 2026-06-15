"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Trash2, Plus } from "lucide-react";
import { trpc } from "@/lib/trpc";

type CatRow = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
  _count: { expenses: number };
};

// ── Create / Edit form ────────────────────────────────────────────────────────

function CategoryForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: CatRow;
  onSave: (data: {
    name: string;
    code: string;
    description: string;
    isDefault: boolean;
    sortOrder: number;
  }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [isDefault, setIsDefault] = useState(initial?.isDefault ?? false);
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !code.trim()) {
      toast.error("Name and code are required.");
      return;
    }
    onSave({
      name: name.trim(),
      code: code.trim().toUpperCase(),
      description: description.trim(),
      isDefault,
      sortOrder,
    });
  }

  const fieldClass =
    "mt-1 block w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block text-sm">
        <span className="font-medium">Name *</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Office Supplies"
          className={fieldClass}
          required
        />
      </label>

      <label className="block text-sm">
        <span className="font-medium">Code *</span>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="e.g. OFFICE"
          className={`${fieldClass} font-mono`}
          required
        />
      </label>

      <label className="block text-sm">
        <span className="font-medium">Description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className={fieldClass}
        />
      </label>

      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-border"
          />
          <span>Default category</span>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <span className="font-medium">Sort order</span>
          <input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
            min={0}
            className="w-20 rounded-md border border-border bg-background px-2 py-1 text-sm"
          />
        </label>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          className="rounded-md border border-primary bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
        >
          {initial ? "Save changes" : "Create category"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/40"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Main client component ─────────────────────────────────────────────────────

export function ExpenseCategoriesClient() {
  const router = useRouter();
  const { data: cats, isLoading } = trpc.expenseCategory.list.useQuery();

  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const utils = trpc.useUtils();

  const createMut = trpc.expenseCategory.create.useMutation({
    onSuccess: () => {
      toast.success("Expense category created.");
      setCreating(false);
      void utils.expenseCategory.list.invalidate();
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMut = trpc.expenseCategory.update.useMutation({
    onSuccess: () => {
      toast.success("Expense category updated.");
      setEditingId(null);
      void utils.expenseCategory.list.invalidate();
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMut = trpc.expenseCategory.delete.useMutation({
    onSuccess: () => {
      toast.success("Expense category deleted.");
      void utils.expenseCategory.list.invalidate();
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  function handleDelete(cat: CatRow) {
    if (cat._count.expenses > 0) {
      toast.error(`Cannot delete — ${String(cat._count.expenses)} expense(s) still use this category.`);
      return;
    }
    if (!window.confirm(`Delete category "${cat.name}"? This cannot be undone.`)) return;
    deleteMut.mutate({ id: cat.id });
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading categories…</p>;
  }

  const rows = cats ?? [];

  return (
    <div className="space-y-4">
      {/* Table */}
      {rows.length > 0 && (
        <div className="rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-2 text-left font-medium">Name</th>
                <th className="px-4 py-2 text-left font-medium">Code</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-left font-medium">Expenses</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((cat) => (
                <tr key={cat.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2">
                    {editingId === cat.id ? (
                      <CategoryForm
                        initial={cat}
                        onSave={(data) =>
                          updateMut.mutate({
                            id: cat.id,
                            name: data.name,
                            code: data.code,
                            description: data.description || undefined,
                            isDefault: data.isDefault,
                            sortOrder: data.sortOrder,
                          })
                        }
                        onCancel={() => setEditingId(null)}
                      />
                    ) : (
                      <span className="font-medium">
                        {cat.name}
                        {cat.isDefault && (
                          <span className="ml-2 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                            default
                          </span>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{cat.code}</td>
                  <td className="px-4 py-2">
                    <span
                      className={
                        cat.isActive
                          ? "text-xs text-green-600 dark:text-green-400"
                          : "text-xs text-muted-foreground"
                      }
                    >
                      {cat.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {cat._count.expenses}
                  </td>
                  {editingId !== cat.id && (
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditingId(cat.id)}
                          className="rounded p-1 hover:bg-muted/40"
                          aria-label="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => handleDelete(cat)}
                          disabled={deleteMut.isPending}
                          className="rounded p-1 hover:bg-destructive/10 disabled:opacity-50"
                          aria-label="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows.length === 0 && !creating && (
        <p className="text-sm text-muted-foreground">No expense categories yet. Add one below.</p>
      )}

      {/* Create form */}
      {creating ? (
        <div className="rounded-lg border border-border bg-card px-6 py-5">
          <p className="mb-4 text-sm font-medium">New expense category</p>
          <CategoryForm
            onSave={(data) =>
              createMut.mutate({
                name: data.name,
                code: data.code,
                description: data.description || undefined,
                isDefault: data.isDefault,
                sortOrder: data.sortOrder,
              })
            }
            onCancel={() => setCreating(false)}
          />
        </div>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-primary hover:text-primary"
        >
          <Plus className="h-3.5 w-3.5" />
          Add category
        </button>
      )}
    </div>
  );
}
