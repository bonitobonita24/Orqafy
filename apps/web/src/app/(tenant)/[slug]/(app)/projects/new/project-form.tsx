"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PROJECT_STATUSES = ["planning", "active", "on_hold", "completed", "cancelled"] as const;
type ProjectStatus = (typeof PROJECT_STATUSES)[number];

const STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: "Planning",
  active: "Active",
  on_hold: "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

interface CustomerOption {
  id: string;
  firstName: string;
  lastName: string;
  companyName: string | null;
}

interface ProjectFormProps {
  slug: string;
  customers: CustomerOption[];
}

interface ProjectFormValues {
  name: string;
  customerId: string;
  description: string;
  status: ProjectStatus;
  startDate: string;
  targetEndDate: string;
  budget: string;
}

const NO_CUSTOMER = "__none__";

function customerLabel(c: CustomerOption): string {
  const company = c.companyName?.trim();
  if (company !== undefined && company.length > 0) return company;
  return `${c.firstName} ${c.lastName}`.trim();
}

export function ProjectForm({ slug, customers }: ProjectFormProps) {
  const router = useRouter();

  const [values, setValues] = useState<ProjectFormValues>({
    name: "",
    customerId: NO_CUSTOMER,
    description: "",
    status: "planning",
    startDate: "",
    targetEndDate: "",
    budget: "",
  });
  const [error, setError] = useState<string | null>(null);

  const set =
    (field: keyof ProjectFormValues) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setValues((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const createMutation = trpc.project.create.useMutation({
    onSuccess: (created) => {
      toast.success("Project created.");
      router.push(`/${slug}/projects/${created.id}`);
      router.refresh();
    },
    onError: (err) => {
      setError(err.message);
      toast.error("Failed to create project.");
    },
  });

  const isPending = createMutation.isPending;

  function submit() {
    setError(null);
    if (values.name.trim().length === 0) {
      setError("Project name is required.");
      return;
    }

    let budget: number | undefined;
    if (values.budget.trim().length > 0) {
      const parsed = Number(values.budget);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setError("Budget must be a positive number.");
        return;
      }
      budget = parsed;
    }

    createMutation.mutate({
      name: values.name.trim(),
      ...(values.customerId !== NO_CUSTOMER ? { customerId: values.customerId } : {}),
      ...(values.description.trim() ? { description: values.description.trim() } : {}),
      status: values.status,
      ...(values.startDate ? { startDate: new Date(values.startDate) } : {}),
      ...(values.targetEndDate ? { targetEndDate: new Date(values.targetEndDate) } : {}),
      ...(budget !== undefined ? { budget } : {}),
    });
  }

  const inputCls =
    "w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {error !== null && (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Details
        </h2>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Project Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={values.name}
            onChange={set("name")}
            className={inputCls}
            maxLength={200}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Customer</label>
          <Select
            value={values.customerId}
            onValueChange={(v) => setValues((prev) => ({ ...prev, customerId: v }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="No customer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_CUSTOMER}>No customer</SelectItem>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {customerLabel(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Status</label>
          <Select
            value={values.status}
            onValueChange={(v) => setValues((prev) => ({ ...prev, status: v as ProjectStatus }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROJECT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Description</label>
          <textarea
            value={values.description}
            onChange={set("description")}
            rows={4}
            className={inputCls}
            maxLength={2000}
            placeholder="What is this project about?"
          />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Schedule &amp; Budget
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Start Date</label>
            <input type="date" value={values.startDate} onChange={set("startDate")} className={inputCls} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Target End Date</label>
            <input
              type="date"
              value={values.targetEndDate}
              onChange={set("targetEndDate")}
              className={inputCls}
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Budget (PHP)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={values.budget}
            onChange={set("budget")}
            className={inputCls}
            placeholder="0.00"
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={submit}
          className="rounded-md border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Create Project"}
        </button>
      </div>
    </div>
  );
}
