"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "@/components/ui/icons";
import { trpc } from "@/lib/trpc";

type DeptRow = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  parentId: string | null;
  isActive: boolean;
  _count: { users: number; employees: number };
};

// ── Create / Edit form ────────────────────────────────────────────────────────

function DepartmentForm({
  initial,
  allDepts,
  onSave,
  onCancel,
}: {
  initial?: DeptRow;
  allDepts: DeptRow[];
  onSave: (data: { name: string; code: string; description: string; parentId: string | null }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [parentId, setParentId] = useState<string>(initial?.parentId ?? "");

  const eligibleParents = allDepts.filter((d) => d.id !== initial?.id);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Department name is required.");
      return;
    }
    onSave({
      name: name.trim(),
      code: code.trim(),
      description: description.trim(),
      parentId: parentId || null,
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
          placeholder="e.g. Engineering"
          className={fieldClass}
          required
        />
      </label>

      <label className="block text-sm">
        <span className="font-medium">Code</span>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="e.g. ENG"
          className={fieldClass}
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

      {eligibleParents.length > 0 && (
        <label className="block text-sm">
          <span className="font-medium">Parent department</span>
          <select
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            className={fieldClass}
          >
            <option value="">— None —</option>
            {eligibleParents.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          className="rounded-md border border-primary bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
        >
          {initial ? "Save changes" : "Create department"}
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

export function DepartmentsClient() {
  const router = useRouter();
  const { data: depts, isLoading } = trpc.department.list.useQuery();

  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const utils = trpc.useUtils();

  const createMut = trpc.department.create.useMutation({
    onSuccess: () => {
      toast.success("Department created.");
      setCreating(false);
      void utils.department.list.invalidate();
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMut = trpc.department.update.useMutation({
    onSuccess: () => {
      toast.success("Department updated.");
      setEditingId(null);
      void utils.department.list.invalidate();
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMut = trpc.department.delete.useMutation({
    onSuccess: () => {
      toast.success("Department deleted.");
      void utils.department.list.invalidate();
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  function handleDelete(dept: DeptRow) {
    const refs = dept._count.users + dept._count.employees;
    if (refs > 0) {
      toast.error(`Cannot delete — ${String(refs)} user(s)/employee(s) still assigned.`);
      return;
    }
    if (!window.confirm(`Delete department "${dept.name}"? This cannot be undone.`)) return;
    deleteMut.mutate({ id: dept.id });
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading departments…</p>;
  }

  const rows = depts ?? [];

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
                <th className="px-4 py-2 text-left font-medium">Members</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((dept) => (
                <tr key={dept.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2">
                    {editingId === dept.id ? (
                      <DepartmentForm
                        initial={dept}
                        allDepts={rows}
                        onSave={(data) =>
                          updateMut.mutate({
                            id: dept.id,
                            name: data.name,
                            code: data.code || undefined,
                            description: data.description || undefined,
                            parentId: data.parentId,
                          })
                        }
                        onCancel={() => setEditingId(null)}
                      />
                    ) : (
                      <span className="font-medium">{dept.name}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                    {dept.code ?? "—"}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={
                        dept.isActive
                          ? "text-xs text-green-600 dark:text-green-400"
                          : "text-xs text-muted-foreground"
                      }
                    >
                      {dept.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {dept._count.users + dept._count.employees}
                  </td>
                  {editingId !== dept.id && (
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditingId(dept.id)}
                          className="rounded p-1 hover:bg-muted/40"
                          aria-label="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => handleDelete(dept)}
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
        <p className="text-sm text-muted-foreground">
          No departments yet. Add one below.
        </p>
      )}

      {/* Create form */}
      {creating ? (
        <div className="rounded-lg border border-border bg-card px-6 py-5">
          <p className="mb-4 text-sm font-medium">New department</p>
          <DepartmentForm
            allDepts={rows}
            onSave={(data) =>
              createMut.mutate({
                name: data.name,
                code: data.code || undefined,
                description: data.description || undefined,
                parentId: data.parentId ?? undefined,
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
          Add department
        </button>
      )}
    </div>
  );
}
