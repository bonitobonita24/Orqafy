"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { FEATURE_KEYS, type FeatureKey } from "@orqafy/shared/rbac";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

const ACTIONS = ["view", "create", "update", "delete"] as const;
type Action = (typeof ACTIONS)[number];

// Guardrail-forbidden features (tenant-rbac-standard.md §4) — custom roles
// may NEVER be granted these; the server rejects them regardless, this is
// UI-side defense-in-depth so the checkboxes never even suggest it.
const FORBIDDEN_FEATURES: readonly FeatureKey[] = ["users", "billing"];

type PermissionRow = {
  featureKey: FeatureKey;
  view: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
};
type PermissionMatrixState = Record<
  FeatureKey,
  { view: boolean; create: boolean; update: boolean; delete: boolean }
>;

type RoleRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isSystem: boolean;
  sortOrder: number;
  permissions: PermissionRow[];
};

// Selection is either "create a new role", an existing editable role's id,
// or nothing selected. Kept as a discriminated shape (not a plain string
// union with a "new" literal) so TypeScript never flags the literal as
// redundant against `string`.
type Selection = { kind: "new" } | { kind: "existing"; roleId: string } | null;

function emptyMatrix(): PermissionMatrixState {
  const out = {} as PermissionMatrixState;
  for (const key of FEATURE_KEYS) {
    out[key] = { view: false, create: false, update: false, delete: false };
  }
  return out;
}

function matrixFromPermissions(permissions: PermissionRow[]): PermissionMatrixState {
  const out = emptyMatrix();
  for (const row of permissions) {
    out[row.featureKey] = {
      view: row.view,
      create: row.create,
      update: row.update,
      delete: row.delete,
    };
  }
  return out;
}

function matrixToPayload(matrix: PermissionMatrixState): PermissionRow[] {
  return FEATURE_KEYS.map((featureKey) => {
    const isForbidden = FORBIDDEN_FEATURES.includes(featureKey);
    const cell = matrix[featureKey];
    return {
      featureKey,
      view: isForbidden ? false : cell.view,
      create: isForbidden ? false : cell.create,
      update: isForbidden ? false : cell.update,
      delete: isForbidden ? false : cell.delete,
    };
  });
}

const featureLabels: Partial<Record<FeatureKey, string>> = {
  dtr: "DTR (Time & Attendance)",
  pos: "POS",
  dsr: "DSR (Data Subject Requests)",
  crm: "CRM",
};

function featureLabel(key: FeatureKey): string {
  return featureLabels[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Permission matrix editor ────────────────────────────────────────────────
// Mounted fresh (via `key`) per selection, so its local state initializes
// once from `initial` with no effect/sync needed to react to selection changes.

function RoleEditor({
  initial,
  onCreate,
  onUpdate,
  onCancel,
  isSaving,
}: {
  initial: { mode: "new" } | { mode: "existing"; role: RoleRow };
  onCreate: (data: { name: string; permissions: PermissionRow[] }) => void;
  onUpdate: (data: { roleId: string; permissions: PermissionRow[] }) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [name, setName] = useState(initial.mode === "existing" ? initial.role.name : "");
  const [matrix, setMatrix] = useState<PermissionMatrixState>(
    initial.mode === "existing" ? matrixFromPermissions(initial.role.permissions) : emptyMatrix(),
  );

  function toggleCell(featureKey: FeatureKey, action: Action) {
    if (FORBIDDEN_FEATURES.includes(featureKey)) return;
    setMatrix((prev) => ({
      ...prev,
      [featureKey]: { ...prev[featureKey], [action]: !prev[featureKey][action] },
    }));
  }

  function handleSave() {
    if (initial.mode === "new" && !name.trim()) {
      toast.error("Role name is required.");
      return;
    }
    const permissions = matrixToPayload(matrix);
    if (initial.mode === "new") {
      onCreate({ name: name.trim(), permissions });
    } else {
      onUpdate({ roleId: initial.role.id, permissions });
    }
  }

  return (
    <div className="space-y-5">
      {initial.mode === "new" ? (
        <div className="max-w-sm space-y-1.5">
          <Label htmlFor="role-name">Role name *</Label>
          <Input
            id="role-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Warehouse Supervisor"
          />
        </div>
      ) : (
        <div>
          <p className="text-sm font-medium">{name}</p>
          <p className="text-xs text-muted-foreground">Editing permissions for this custom role.</p>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Feature</TableHead>
              {ACTIONS.map((action) => (
                <TableHead key={action} scope="col" className="text-center capitalize">
                  {action}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {FEATURE_KEYS.map((featureKey) => {
              const forbidden = FORBIDDEN_FEATURES.includes(featureKey);
              return (
                <TableRow key={featureKey}>
                  <TableCell className="font-medium">
                    {featureLabel(featureKey)}
                    {forbidden && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        Reserved for owner
                      </span>
                    )}
                  </TableCell>
                  {ACTIONS.map((action) => (
                    <TableCell key={action} className="text-center">
                      <input
                        type="checkbox"
                        disabled={forbidden}
                        checked={forbidden ? false : matrix[featureKey][action]}
                        onChange={() => toggleCell(featureKey, action)}
                        aria-label={`${featureLabel(featureKey)} — ${action}`}
                        className="size-4 rounded border-input accent-primary disabled:cursor-not-allowed disabled:opacity-40"
                      />
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Saving…" : initial.mode === "new" ? "Create role" : "Save changes"}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ── Main client component ───────────────────────────────────────────────────

export function RolesClient() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: roles, isPending } = trpc.role.list.useQuery();

  const [selection, setSelection] = useState<Selection>(null);

  const editableRoles = (roles ?? []).filter((r) => !r.isSystem);
  const systemRoles = (roles ?? []).filter((r) => r.isSystem);
  const selectedRole =
    selection?.kind === "existing" ? editableRoles.find((r) => r.id === selection.roleId) : undefined;

  const createMut = trpc.role.create.useMutation({
    onSuccess: () => {
      toast.success("Role created.");
      setSelection(null);
      void utils.role.list.invalidate();
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMut = trpc.role.update.useMutation({
    onSuccess: () => {
      toast.success("Role updated.");
      void utils.role.list.invalidate();
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const isSaving = createMut.isPending || updateMut.isPending;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
      {/* Left: role list */}
      <Card className="h-fit p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Custom roles
        </p>
        <div className="space-y-1">
          {editableRoles.length === 0 && (
            <p className="text-sm text-muted-foreground">No custom roles yet.</p>
          )}
          {editableRoles.map((role) => (
            <button
              key={role.id}
              type="button"
              onClick={() => setSelection({ kind: "existing", roleId: role.id })}
              className={`block w-full rounded-md px-3 py-1.5 text-left text-sm ${
                selection?.kind === "existing" && selection.roleId === role.id
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-foreground hover:bg-muted/40"
              }`}
            >
              {role.name}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setSelection({ kind: "new" })}
          className={`mt-3 flex w-full items-center gap-1.5 rounded-md border border-dashed px-3 py-1.5 text-xs ${
            selection?.kind === "new"
              ? "border-primary text-primary"
              : "border-border text-muted-foreground hover:border-primary hover:text-primary"
          }`}
        >
          <Plus className="h-3.5 w-3.5" />
          New role
        </button>

        {systemRoles.length > 0 && (
          <>
            <p className="mb-2 mt-5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              System roles
            </p>
            <div className="space-y-1">
              {systemRoles.map((role) => (
                <div
                  key={role.id}
                  className="flex items-center justify-between rounded-md px-3 py-1.5 text-sm text-muted-foreground"
                >
                  <span>{role.name}</span>
                  <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium">
                    system
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* Right: permission matrix editor */}
      <Card className="p-5">
        {selection === null && (
          <p className="text-sm text-muted-foreground">
            Select a custom role to edit, or create a new one.
          </p>
        )}

        {selection?.kind === "new" && (
          <RoleEditor
            key="new"
            initial={{ mode: "new" }}
            onCreate={(data) => createMut.mutate(data)}
            onUpdate={() => undefined}
            onCancel={() => setSelection(null)}
            isSaving={isSaving}
          />
        )}

        {selection?.kind === "existing" && selectedRole && (
          <RoleEditor
            key={selectedRole.id}
            initial={{ mode: "existing", role: selectedRole }}
            onCreate={() => undefined}
            onUpdate={(data) => updateMut.mutate(data)}
            onCancel={() => setSelection(null)}
            isSaving={isSaving}
          />
        )}
      </Card>
    </div>
  );
}
