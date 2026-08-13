"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface TechnicianUser {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
}

interface AssignTechnicianProps {
  jobOrderId: string;
  currentTechnicianId: string | null;
  users: TechnicianUser[];
}

function userLabel(u: TechnicianUser): string {
  const display = u.displayName?.trim();
  if (display !== undefined && display.length > 0) return display;
  return `${u.firstName} ${u.lastName}`.trim();
}

export function AssignTechnician({
  jobOrderId,
  currentTechnicianId,
  users,
}: AssignTechnicianProps): React.ReactElement {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(currentTechnicianId ?? "");
  const [isEditing, setIsEditing] = useState(false);

  const assignMut = trpc.jobOrder.assignTechnician.useMutation({
    onSuccess: (_data, variables) => {
      const tech = users.find((u) => u.id === variables.technicianId);
      const name = tech !== undefined ? userLabel(tech) : "Technician";
      toast.success(`${name} assigned.`);
      setIsEditing(false);
      router.refresh();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  if (!isEditing) {
    const current = users.find((u) => u.id === currentTechnicianId);
    return (
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {current !== undefined ? userLabel(current) : "Unassigned"}
        </span>
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="ml-2 rounded border border-border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          {current !== undefined ? "Reassign" : "Assign"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <select
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        className="block rounded-md border border-border bg-background px-2 py-1 text-sm focus:outline-hidden focus:ring-1 focus:ring-primary"
        autoFocus
      >
        <option value="">— Select technician —</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {userLabel(u)}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={!selectedId || assignMut.isPending}
        onClick={() => {
          if (!selectedId) return;
          assignMut.mutate({ id: jobOrderId, technicianId: selectedId });
        }}
        className="rounded-md border border-primary bg-primary/10 px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
      >
        {assignMut.isPending ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        onClick={() => {
          setSelectedId(currentTechnicianId ?? "");
          setIsEditing(false);
        }}
        className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/40"
      >
        Cancel
      </button>
    </div>
  );
}
